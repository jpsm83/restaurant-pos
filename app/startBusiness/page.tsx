// app/startBusiness/page.tsx
import { BusinessProfileForm } from "./BusinessProfileForm";

export default function StartBusinessPage() {
  return (
    <div>
      <h1 className="text-3xl">Start Your Business</h1>
      <BusinessProfileForm />
    </div>
  );
}