package controllers

import java.util.{Observable, Observer}

import akka.actor.{Actor, ActorRef}
import com.tokeh.gameoflife.controller.impl.ControllerImpl
import com.tokeh.gameoflife.model.impl.OriginalWorldRules
import com.tokeh.gameoflife.model.Rules
import com.tokeh.gameoflife.view.gui.SwingView
import com.tokeh.gameoflife.view.text.TextView
import play.api.libs.json.JsValue

class GameOfLifeActor extends Actor with Observer {

  val controller = new ControllerImpl()
  val rules: Rules = new OriginalWorldRules
  controller.configureStepper(rules, rules.name)
  val textView = new TextView(controller)
  val swingView = new SwingView(controller)
  val outSockets = new scala.collection.mutable.HashSet[ActorRef]

  controller.addObserver(this)

  def receive = {
    case commandObject: JsValue =>
      val cmd = commandObject \ "command"
      textView.readAndInterpretFromArgument(cmd.as[String])
    case  addOutSocket: AddOutgoingSocket =>
      outSockets += addOutSocket.outSocket
      // Init
      update(null, null)
  }

  override def update(o: Observable, arg: Object): Unit = {
    for (socket <- outSockets) {
      socket ! GridToJson.getGridAsJson(controller)
    }
  }
}
