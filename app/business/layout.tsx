import { BusinessNav } from "@/components/business/business-nav";

export default function BusinessLayout({ children }: LayoutProps<"/business">) {
  return (
    <div className="mx-auto max-w-4xl">
      <BusinessNav />
      {children}
    </div>
  );
}
