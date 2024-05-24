import m from "mithril";

interface StatusTileAttrs {
  editableValue?: string;
  displayValue: string;
  subscript: m.Children;
  onChange?: (value: string) => void;
}
export const StatusTile: m.ClosureComponent<StatusTileAttrs> = (initialVnode) => {
  let prevValue: string | undefined;
  let editableValueElem: HTMLElement | undefined;
  let latestVnode = initialVnode;
  const focusAndSelectAll = (el: HTMLElement) => {
    el.focus();

    // Select all.
    const selection = window.getSelection();
    if (selection) {
      const selectAllRange = document.createRange();
      selectAllRange.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(selectAllRange);
    }
  };
  const isEditing = () => {
    return document.activeElement === editableValueElem;
  };
  return {
    oncreate(vnode) {
      const el = vnode.dom.querySelector(".editable-value");
      if (!(el instanceof HTMLElement)) return;

      editableValueElem = el;

      el.contentEditable = "true";
      el.inputMode = "decimal";
      el.spellcheck = false;

      const { onChange } = vnode.attrs;
      if (onChange) {
        el.addEventListener("blur", () => {
          m.redraw();
          const value = el.textContent ?? "";
          if (value !== prevValue) onChange(value);
          el.textContent = latestVnode.attrs.displayValue;
        });
        el.addEventListener("keydown", (event: KeyboardEvent) => {
          if (event.code === "Enter") {
            event.preventDefault();
            el.blur();
          }
        });
      }
    },
    onupdate(vnode) {
      latestVnode = vnode;
      if (editableValueElem && !isEditing()) {
        editableValueElem.textContent = latestVnode.attrs.displayValue;
      }
    },
    view({ attrs: { editableValue, displayValue, subscript, onChange } }) {
      const editable = onChange !== undefined && editableValue !== undefined;
      const editing = isEditing();
      return m(
        ".status-tile",
        {
          className: [editable && "editable", editing && "editing"].filter((n) => n).join(" "),
          onpointerdown: (event: PointerEvent) => {
            if (editable && !editing) {
              prevValue = editableValue;
              if (editableValueElem) {
                editableValueElem.textContent = editableValue;
                focusAndSelectAll(editableValueElem);
              }
              event.preventDefault();
            }
          },
        },
        [
          m(".status-tile-value", [editable ? m(".editable-value", displayValue) : displayValue]),
          m(".status-tile-subscript", subscript),
        ]
      );
    },
  };
};
