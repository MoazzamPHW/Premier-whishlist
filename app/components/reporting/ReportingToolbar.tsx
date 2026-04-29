type ReportingToolbarProps = {
  sort: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSortChange: (value: string) => void;
  exportHref: string;
};

export default function ReportingToolbar({
  sort,
  query,
  onQueryChange,
  onSortChange,
  exportHref,
}: ReportingToolbarProps) {
  return (
    <div className="reporting-toolbar">
      <div className="reporting-search">
        <s-search-field
          label="Search"
          labelAccessibilityVisibility="exclusive"
          placeholder="Search product name"
          value={query}
          onChange={(event) => {
            const value =
              (
                event as unknown as {
                  detail?: { value?: string };
                  target?: { value?: string };
                }
              )?.detail?.value ||
              (event as unknown as { target?: { value?: string } })?.target
                ?.value ||
              "";
            onQueryChange(value);
          }}
        />
      </div>
      <div className="reporting-actions">
        <select value={sort} onChange={(event) => onSortChange(event.target.value)}>
          <option value="title_asc">Title (A-Z)</option>
          <option value="title_desc">Title (Z-A)</option>
          <option value="inventory_desc">Inventory (High-Low)</option>
          <option value="inventory_asc">Inventory (Low-High)</option>
          <option value="count_desc">Wishlist count (High-Low)</option>
          <option value="count_asc">Wishlist count (Low-High)</option>
          <option value="purchased_desc">Purchased times (High-Low)</option>
          <option value="purchased_asc">Purchased times (Low-High)</option>
        </select>
        <s-button  variant="secondary" href={exportHref}>
          Export CSV
        </s-button>
      </div>
    </div>
  );
}
