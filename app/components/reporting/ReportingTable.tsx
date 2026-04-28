import type { ReportingRow } from "../../types/reporting";

type ReportingTableProps = {
  rows: ReportingRow[];
};

export default function ReportingTable({ rows }: ReportingTableProps) {
  return (
    <div className="reporting">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Inventory</th>
            <th>Users</th>
            <th>Bought</th>
            <th>Purchased users</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.productId}>
              <td>
                <div className="product-cell">
                  <div className="thumb">
                    {row.imageUrl && <img src={row.imageUrl} alt={row.title} />}
                  </div>
                  <div>{row.title}</div>
                </div>
              </td>
              <td>{row.sku || "-"}</td>
              <td>{row.inventory ?? "-"}</td>
              <td>
                <div className="users">
                  {row.users.map((email) => (
                    <span key={email}>{email}</span>
                  ))}
                </div>
              </td>
              <td>{row.bought ? "Yes" : "No"}</td>
              <td>
                <div className="users">
                  {row.purchasedUsers.length
                    ? row.purchasedUsers.map((email) => (
                        <span key={email}>{email}</span>
                      ))
                    : "-"}
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={6}>No results found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
