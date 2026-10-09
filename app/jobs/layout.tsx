import { JobsNav } from "@/components/jobs/job-parts";

export default function JobsLayout({ children }: LayoutProps<"/jobs">) {
  return (
    <div className="mx-auto max-w-4xl">
      <JobsNav />
      {children}
    </div>
  );
}
