import { Component } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import "zone.js";
import { TodoComponent } from "./app/todo/todo.component";
import { TodoService } from "./app/todo/todo.service";
import { HttpClientModule } from "@angular/common/http";

@Component({
  selector: "app-root",
  standalone: true,
  template: `<app-todo></app-todo>`,
  imports: [TodoComponent, HttpClientModule],
  providers: [TodoService],
})
export class App {
  name = "Angular";
}

bootstrapApplication(App);
