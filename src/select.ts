import m from "mithril";

interface SelectInputAttrs {
  options: string[];
  selected?: string;
  onChange: (index: number) => void;

  className?: string;
}
export const SelectInput: m.Component<SelectInputAttrs> = {
  view({ attrs: { options, selected, onChange, className } }) {
    return m(
      "select",
      {
        className,
        onchange: (event: Event) => {
          if (event.target instanceof HTMLSelectElement) {
            onChange(event.target.selectedIndex);
          }
        },
      },
      options.map((option) => {
        return m(
          "option",
          {
            value: option,
            selected: selected !== undefined && selected === option,
          },
          option
        );
      })
    );
  },
};
