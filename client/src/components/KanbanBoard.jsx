import { useState } from 'react';

/**
 * Generic Notion-style board: one column per entry in `columns`, native HTML5
 * drag-and-drop. `canDrag`/`canDrop` gate which cards/columns respond, so the
 * same board can be read-only (no props set) or fully editable.
 */
export default function KanbanBoard({ columns, tasks, renderCard, canDrag, canDrop, onMove, onCardClick }) {
  const [draggingId, setDraggingId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);

  function handleDragStart(task) {
    if (canDrag && !canDrag(task)) return;
    setDraggingId(task.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverColumn(null);
  }

  function handleDrop(columnValue) {
    const task = tasks.find((t) => t.id === draggingId);
    setOverColumn(null);
    if (!task) return;
    if (task.phase === columnValue) return;
    if (canDrop && !canDrop(columnValue, task)) return;
    onMove?.(task, columnValue);
  }

  return (
    <div className="kanban">
      {columns.map((col) => {
        const columnTasks = tasks.filter((t) => t.phase === col.value);
        const isDropTarget = overColumn === col.value;
        return (
          <div
            key={col.value}
            className={`kanban__column${isDropTarget ? ' kanban__column--over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (overColumn !== col.value) setOverColumn(col.value);
            }}
            onDragLeave={() => setOverColumn((c) => (c === col.value ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(col.value);
            }}
          >
            <div className="kanban__column-header">
              <span>{col.label}</span>
              <span className="kanban__count">{columnTasks.length}</span>
            </div>
            <div className="kanban__column-body">
              {columnTasks.length === 0 && <div className="kanban__empty">No tasks</div>}
              {columnTasks.map((task) => {
                const draggable = canDrag ? canDrag(task) : false;
                return (
                  <div
                    key={task.id}
                    className={`kanban__card${draggable ? ' kanban__card--draggable' : ''}${onCardClick ? ' kanban__card--clickable' : ''}`}
                    draggable={draggable}
                    onDragStart={() => handleDragStart(task)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onCardClick?.(task)}
                  >
                    {renderCard(task)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
