package controllers

import java.util.UUID

import akka.actor.{ActorRef, ActorSystem, Props}
import akka.util.Timeout
import play.api.Play.current
import play.api.libs.json._
import play.api.libs.ws.WS
import play.api.mvc._

import scala.collection.mutable
import scala.concurrent.duration._
import scala.concurrent.{Await, duration}

object Application extends Controller {

  private val HighscoreServer = ""
  private val runningGames: mutable.Set[String] = new mutable.HashSet[String]
  private val actorSystem = ActorSystem.create("GameOfLife")

  def index = Action {
    Ok(views.html.index.render(runningGames))
  }

  def playGameByID(gameId: String) = Action {
    if (gameNotExisting(gameId)) {
      Redirect(routes.Application.createNewGame())
    }
    Ok(views.html.game.render(gameId))
  }

  def createNewGame() = Action { implicit request =>
    val gameId = UUID.randomUUID().toString

    actorSystem.actorOf(Props[GameOfLifeActor], gameId)
    runningGames.add(gameId)

    Ok(Json.obj("gameUrl" -> routes.Application.playGameByID(gameId).absoluteURL()))
  }

  def getGameActorById(gameId: String): Option[ActorRef] = {
    val selectedActor = actorSystem.actorSelection("/user/" + gameId)
    val future = selectedActor.resolveOne(Timeout(2.seconds).duration)

    try {
      Some(Await.result(future, Duration(5, duration.SECONDS)))
    }
    catch {
      case _: Exception => None
    }
  }

  def gameNotExisting(gameId: String): Boolean = {
    getGameActorById(gameId).isEmpty
  }

  def createHighscore() = Action(parse.json) { request =>
    WS.url(HighscoreServer).post(request.body)
    Ok(Json.obj())
  }

  def connectWebSocket(gameId: String) = WebSocket.acceptWithActor[JsValue, JsValue] { request => out =>
    if (gameNotExisting(gameId)) {
      Redirect(routes.Application.createNewGame())
    }
    val game = getGameActorById(gameId).get
    game ! AddOutgoingSocket(out)
    Props(new WebSocketActor(game))
  }

}