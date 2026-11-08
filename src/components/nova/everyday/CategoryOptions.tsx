import { CATEGORY_LABEL, SPENDING_CATEGORIES } from "@/lib/bank/view";

/** <option>s for every category: the 16 spending categories, then money that isn't spending. */
export function CategoryOptions() {
  return (
    <>
      <optgroup label="Spending">
        {SPENDING_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
      </optgroup>
      <optgroup label="Not spending">
        <option value="income">{CATEGORY_LABEL.income}</option>
        <option value="transfer">{CATEGORY_LABEL.transfer}</option>
      </optgroup>
    </>
  );
}
