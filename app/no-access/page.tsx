import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { signOutAction } from "@/app/actions";

export default function NoAccess() {
  return (
    <div className="grid place-items-center" style={{ minHeight: "100dvh", padding: 20 }}>
      <div className="card" style={{ maxWidth: 460, width: "100%" }}>
        <EmptyState
          icon={ShieldOff}
          title="This screen is not open to your account"
          hint="Ask the admin to give you access in Settings → User Management."
          action={
            <div className="flex gap-2 justify-center">
              <Link href="/" className="btn btn-secondary">Go to the start</Link>
              <form action={signOutAction}><button className="btn btn-ghost" type="submit">Sign out</button></form>
            </div>
          }
        />
      </div>
    </div>
  );
}
