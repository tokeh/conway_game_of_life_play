package controllers

import akka.actor.{ActorRef, Actor}

class WebSocketActor(game: ActorRef) extends Actor {

  def receive = {
    case msg:Any => game ! msg
  }

}
