interface DragData {
  value: boolean;
  level: number;
  draggedID: string;
  set: ((b: boolean) => void) | null;
}

let data: DragData | null = null;

export const onDragStart = (
  value: boolean,
  level: number,
  id: string,
  set: (b: boolean) => void,
) => {
  data = { value, level, draggedID: id, set };
};

export const onDragEnd = () => {
  data = null;
};

export const onDragEnter = (
  level: number,
  id: string,
  set: (b: boolean) => void,
) => {
  if (!data || data.level !== level || data.draggedID === id) return;
  if (data.set) {
    data.set(data.value);
    data.set = null;
  }
  set(data.value);
};
