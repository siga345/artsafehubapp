import { CommunityProfilePage } from "@/components/community/community-profile-page";

export default function CommunityCreatorPage({ params }: { params: { safeId: string } }) {
  return <CommunityProfilePage safeId={params.safeId} />;
}
