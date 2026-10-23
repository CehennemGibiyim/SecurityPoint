import { PersonelDetailClient } from "@/components/personel-detail-client";

export function generateStaticParams() {
  return Array.from({ length: 60 }, (_, idx) => ({ id: String(idx + 1) }));
}

export default async function PersonelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PersonelDetailClient employeeId={id} />;
}
