import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import { getReportingRows } from "../utils/reporting.server";
import "../styles/reporting.css";
import ReportingToolbar from "../components/reporting/ReportingToolbar";
import ReportingTable from "../components/reporting/ReportingTable";
import ReportingPagination from "../components/reporting/ReportingPagination";
import type { LoaderData } from "../types/reporting";
import { useDebouncedValue } from "../utils/debounce";

const PAGE_SIZE = 20;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") || "1");
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const sort = url.searchParams.get("sort") || "title_asc";
  const q = url.searchParams.get("q") || "";

  const rows = await getReportingRows({
    admin,
    shopDomain: session.shop,
    query: q,
    sort,
  });

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return {
    rows: pageRows,
    page: safePage,
    totalPages,
    sort,
    q,
  };
};

export default function Reporting() {
  const { rows, page, totalPages, sort, q } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(q);
  const debouncedQuery = useDebouncedValue(query, 400);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const current = params.get("q") || "";
    if (debouncedQuery === current) return;
    if (debouncedQuery) {
      params.set("q", debouncedQuery);
    } else {
      params.delete("q");
    }
    params.set("page", "1");
    params.set("sort", sort);
    navigate(`/app/reporting?${params.toString()}`);
  }, [debouncedQuery, navigate, searchParams, sort]);

  const makeHref = (nextPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    params.set("sort", sort);
    if (query) params.set("q", query);
    return `/app/reporting?${params.toString()}`;
  };

  const exportHref = () => {
    const params = new URLSearchParams(searchParams);
    if (query) params.set("q", query);
    params.set("sort", sort);
    params.delete("page");
    return `/app/reporting/csv?${params.toString()}`;
  };

  return (
    <s-page heading="Reporting">
      <s-section>
        <ReportingToolbar
          sort={sort}
          query={query}
          onQueryChange={setQuery}
          onSortChange={(value) => {
            const params = new URLSearchParams(searchParams);
            params.set("sort", value);
            params.set("page", "1");
            if (query) params.set("q", query);
            navigate(`/app/reporting?${params.toString()}`);
          }}
          exportHref={exportHref()}
        />
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <ReportingTable rows={rows} />
        </s-box>
        <ReportingPagination
          page={page}
          totalPages={totalPages}
          makeHref={makeHref}
        />
      </s-section>
    </s-page>
  );
}
