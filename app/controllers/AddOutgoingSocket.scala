package controllers

import akka.actor.ActorRef

case class AddOutgoingSocket(outSocket: ActorRef)
