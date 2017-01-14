package controllers

import com.tokeh.gameoflife.controller.Controller
import com.tokeh.gameoflife.model.Grid
import play.api.libs.json._

object GridToJson {

  def getGridAsJson(controller: Controller): JsObject = {
    val grid = controller.grid

    Json.obj(
      "cells" -> getCellsJsArray(grid),
      "generationStrategy" -> controller.stepperName,
      "numberOfSteppedGenerations" -> controller.steppedGenerations
    )
  }

  private def getCellsJsArray(grid: Grid): JsArray = {
    var cells = Json.arr()

    for (i <- 0 until grid.numberOfRows) {
      var row = Json.arr()

      for (j <- 0 until grid.numberOfColumns) {
        row = row :+ JsBoolean(grid(i)(j))
      }

      cells = cells :+ row
    }

    cells
  }

}
