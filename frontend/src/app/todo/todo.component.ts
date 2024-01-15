import { Component } from '@angular/core';
import { Todo } from './todo.model';
import { TodoService } from './todo.service';

@Component({
  selector: 'app-todo',
  templateUrl: './todo.component.html',
  styleUrls: ['./todo.component.css'],
})
export class TodoComponent {
  todos: Todo[] = [];

  constructor(private todoService: TodoService) {
    this.getAll();
  }

  getAll(): void {
    this.todoService.getTodos().subscribe((todos) => (this.todos = todos));
  }

  create(name: string): void {
    this.todoService
      .createTodo({ name: name, status: false })
      .subscribe((res) => this.getAll());
  }

  updateStatus(todo: Todo, status: boolean): void {
    this.todoService
      .updateTodo(todo.id!, { ...todo, status: status })
      .subscribe((res) => this.getAll());
  }

  delete(todo: Todo): void {
    this.todoService.deleteTodo(todo.id!).subscribe((res) => this.getAll());
  }
}
