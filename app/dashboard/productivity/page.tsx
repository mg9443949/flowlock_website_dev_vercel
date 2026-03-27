import dynamic from "next/dynamic"

const ProductivityReportPage = dynamic(
  () => import("@/components/dashboard/pages/productivity-report-page").then(mod => mod.ProductivityReportPage),
  { ssr: false }
)

export default function ProductivityPage() {
    return <ProductivityReportPage />
}
