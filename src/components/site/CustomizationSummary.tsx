import type { CustomizationSelection } from "@/lib/decora";

export function CustomizationSummary({ selections }: { selections?: CustomizationSelection }) {
  if (!selections?.length) return null;
  return (
    <dl className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">
      {selections.map((selection) => (
        <div key={selection.label} className="break-words">
          <dt className="inline font-semibold">{selection.label}: </dt>
          <dd className="inline whitespace-pre-wrap">{selection.value}</dd>
        </div>
      ))}
    </dl>
  );
}
