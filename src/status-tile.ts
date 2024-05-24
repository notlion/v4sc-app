import m from "mithril";

interface StatusTileAttrs {
  editableValue?: string;
  displayValue: m.Children;
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

      el.setAttribute("contenteditable", "true");
      el.setAttribute("inputmode", "decimal");
      el.spellcheck = false;

      const { onChange } = vnode.attrs;
      if (onChange) {
        el.addEventListener("blur", () => {
          const value = el.textContent ?? "";
          if (value === prevValue) return;
          onChange(value);
          m.redraw();
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
      return m(
        ".status-tile",
        {
          className: isEditable ? "editable" : undefined,
          onpointerdown: (event: PointerEvent) => {
            if (isEditable && document.activeElement !== editableValueElem) {
              prevValue = editableValue;
              if (editableValueElem) {
                focusAndSelectAll(editableValueElem);
              }
              event.preventDefault();
            }
          },
        },
        [
          m(".status-tile-value", isEditable ? m(".editable-value", editableValue) : displayValue),
          m(".status-tile-subscript", subscript),
        ]
      );
    },
  };
};
