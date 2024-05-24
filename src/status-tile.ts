import m from "mithril";

interface StatusTileAttrs {
  editableValue?: string;
  displayValue: string;
  subscript: m.Children;
  onChange?: (value: string) => void;
}
export const StatusTile: m.ClosureComponent<StatusTileAttrs> = () => {
  let prevValue: string | undefined;
  let editableValueElem: HTMLElement | undefined;
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
          el.textContent = vnode.attrs.displayValue;
        });
        el.addEventListener("keydown", (event: KeyboardEvent) => {
          if (event.code === "Enter") {
            event.preventDefault();
            el.blur();
          }
        });
      }
    },
    view({ attrs: { editableValue, displayValue, subscript, onChange } }) {
      const isEditable = onChange !== undefined && editableValue !== undefined;
      const isEditing = document.activeElement === editableValueElem;
      return m(
        ".status-tile",
        {
          className: [isEditable && "editable", isEditing && "editing"].filter((n) => n).join(" "),
          onpointerdown: (event: PointerEvent) => {
            if (isEditable && !isEditing) {
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
          m(".status-tile-value", [isEditable ? m(".editable-value", displayValue) : displayValue]),
          m(".status-tile-subscript", subscript),
        ]
      );
    },
  };
};
