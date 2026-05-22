"use client";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-odyssey-mist">
      <div className="text-center mb-8">
        <SignIn />
      </div>
    </div>
  );
}
