import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgStyle } from '@angular/common';
import { Todo } from '../todo.model';

@Component({
  selector: 'app-todo-item',
  standalone: true,
  imports: [NgStyle],
  templateUrl: './todo-item.component.html',
  styleUrl: './todo-item.component.css',
})
export class TodoItemComponent {
  @Input()
  todo!: Todo;

  @Output()
  onUpdate = new EventEmitter<Todo>();

  @Output()
  onDelete = new EventEmitter();

  updateStatus(status: boolean): void {
    this.onUpdate.emit({ ...this.todo, status: status });
  }

  delete(): void {
    this.onDelete.emit();
  }
}
