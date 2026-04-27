"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui";
import { Package, Boxes, ArrowRight } from "lucide-react";
import { User } from "@/lib/types";

export default function PublicLandingPage() {
  const params = useParams();
  const adminSlug = params.adminSlug as string;
  
  const { getAdminBySlug } = useStore();
  const [admin, setAdmin] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminBySlug(adminSlug).then((u) => {
      setAdmin(u ?? null);
      setLoading(false);
    });
  }, [adminSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-[#1A1A1A]">Page Not Found</h1>
          <p className="text-[#6B7280]">
            This store doesn&apos;t exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  const options = [
    {
      href: `/${adminSlug}/catalog`,
      title: "Browse Catalog",
      description: "Explore our ready-made furniture collection. Choose from pre-designed pieces with various customization options.",
      icon: Package,
      color: "text-[#E8772E]",
      bgColor: "bg-[#FEF3E7]",
    },
    {
      href: `/${adminSlug}/builder`,
      title: "Build with Modules",
      description: "Create your own furniture by combining modular units. Mix and match pieces to build exactly what you need.",
      icon: Boxes,
      color: "text-[#E8772E]",
      bgColor: "bg-[#FEF3E7]",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      {/* Header */}
      <header className="bg-white border-b border-[#F0E6D8]">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {admin.logo ? (
              <img
                src={admin.logo}
                alt={admin.companyName}
                className="w-12 h-12 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-[#E8772E] flex items-center justify-center text-white font-bold text-xl shadow-sm">
                {admin.companyName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-[#1A1A1A]">{admin.companyName}</h1>
              <p className="text-[#6B7280]">
                Custom furniture solutions
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4 text-[#1A1A1A]">
            How would you like to get started?
          </h2>
          <p className="text-lg text-[#6B7280] max-w-2xl mx-auto">
            Choose the option that best fits your needs. Browse our catalog or build with modules.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <Link key={option.href} href={option.href}>
                <Card variant="interactive" className="h-full group rounded-2xl border-[#F0E6D8] hover:border-[#E8772E]/40 hover:shadow-lg transition-all">
                  <CardHeader className="h-full flex flex-col">
                    <div className={`w-16 h-16 rounded-2xl ${option.bgColor} flex items-center justify-center mb-4`}>
                      <Icon className={`w-8 h-8 ${option.color}`} />
                    </div>
                    <CardTitle className="flex items-center justify-between mb-2 text-[#1A1A1A]">
                      {option.title}
                      <ArrowRight className="w-5 h-5 text-[#6B7280] group-hover:text-[#E8772E] group-hover:translate-x-1 transition-all" />
                    </CardTitle>
                    <CardDescription className="flex-1 text-[#6B7280]">
                      {option.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#F0E6D8] bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-sm text-[#6B7280]">
          <p>Powered by Tunzone</p>
        </div>
      </footer>
    </div>
  );
}
