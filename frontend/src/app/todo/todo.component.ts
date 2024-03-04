import { Component } from '@angular/core';
import { TodoItemComponent } from './todo-item/todo-item.component';
import { Todo } from './todo.model';
import { NgFor } from '@angular/common';
import { TodoService } from './todo.service';

@Component({
  selector: 'app-todo',
  standalone: true,
  imports: [NgFor, TodoItemComponent],
  templateUrl: './todo.component.html',
  styleUrl: './todo.component.css',
})
export class TodoComponent {
  todos: Todo[] = [];

  constructor(private todoService: TodoService) {
    this.getAll();
  }

  getAll(): void {
    this.todoService.getTodos().subscribe((todos) => (this.todos = todos));
  }

  createTodo(name: string): void {
    // this.todos.push({
    //   id: '1',
    //   name: name,
    //   status: false,
    // });
    this.todoService
      .createTodo({ name: name, status: false })
      .subscribe((res) => this.getAll());
  }

  updateTodo(todo: Todo): void {
    // this.todos = this.todos.map((t) => (t.name === todo.name ? todo : t));
    this.todoService
      .updateTodo(todo.id!, todo)
      .subscribe((res) => this.getAll());
  }

  deleteTodo(todo: Todo): void {
    // this.todos = this.todos.filter((t) => t !== todo);
    this.todoService.deleteTodo(todo.id!).subscribe((res) => this.getAll());
  }
}
