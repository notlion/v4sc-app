import m from "mithril";

interface StatusTileAttrs {
  editableValue?: string;
  displayValue: m.Children;
  subscript: m.Children;
  onChange?: (value: string) => void;
}
export const StatusTile: m.ClosureComponent<StatusTileAttrs> = () => {
  let isEditing = false;
  let prevValue: string | undefined;
  return {
    view({ attrs: { editableValue, displayValue, subscript, onChange } }) {
      const isEditable = onChange !== undefined;
      return m(
        ".status-tile",
        {
          className: isEditable ? "editable" : undefined,
          onpointerdown: (event: PointerEvent) => {
            if (isEditable && !isEditing) {
              isEditing = true;
              prevValue = editableValue;
              event.preventDefault();
            }
          },
        },
        [
          m(
            ".status-tile-value",
            isEditing && editableValue !== undefined
              ? m(EditableValue, {
                  value: editableValue.toString(),
                  onChange: (value) => {
                    isEditing = false;
                    if (value !== prevValue) {
                      onChange!(value);
                    }
                  },
                })
              : displayValue
          ),
          m(".status-tile-subscript", subscript),
        ]
      );
    },
  };
};

interface EditableValueAttrs {
  value: string;
  onChange: (value: string) => void;
}
const EditableValue: m.Component<EditableValueAttrs> = {
  oncreate(vnode) {
    const el = vnode.dom;
    if (!(el instanceof HTMLElement)) return;

    el.setAttribute("contenteditable", "true");
    el.setAttribute("inputmode", "decimal");
    el.spellcheck = false;

    el.focus();

    // Select all.
    const selection = window.getSelection();
    if (selection) {
      const selectAllRange = document.createRange();
      selectAllRange.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(selectAllRange);
    }

    const { onChange } = vnode.attrs;
    el.addEventListener("blur", () => {
      onChange(el.textContent ?? "");
      m.redraw();
    });
    el.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.code === "Enter") {
        event.preventDefault();
        el.blur();
      }
    });
  },
  view({ attrs: { value } }) {
    return m(".editable-value", value);
  },
};
