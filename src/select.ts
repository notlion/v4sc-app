import m from "mithril";

interface SelectInputAttrs {
  options: string[];
  selected?: string;
  onChange: (index: number) => void;
}
export const SelectInput: m.Component<SelectInputAttrs> = {
  view({ attrs: { options, selected, onChange } }) {
    let opts = options.map((option) => {
      return m(
        "option",
        {
          value: option,
          selected: selected !== undefined && selected === option,
        },
        option
      );
    });
    opts.unshift(m("option", { value: "", selected: selected === undefined }, ""));
    return m(
      "select",
      {
        onchange: (event: Event) => {
          if (event.target instanceof HTMLSelectElement) {
            onChange(event.target.selectedIndex - 1);
          }
        },
      },
      opts
    );
  },
};
