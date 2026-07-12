"use client";

import { useState } from "react";
import type { TenantSettingsFull } from "@/application/tenant/tenant-settings.repository";
import { GeneralSettingsForm } from "@/presentation/tenant/components/general-settings-form";
import { RelanceSettingsForm } from "@/presentation/tenant/components/relance-settings-form";
import { AppearanceSettingsSection } from "@/presentation/tenant/components/appearance-settings-section";
import {
  ParametresTabs,
  type ParametresTabKey,
} from "@/presentation/tenant/components/parametres-tabs";
import { tenantSettingsLabels } from "@/presentation/shared/labels";

const TABS: { key: ParametresTabKey; label: string }[] = [
  { key: "general", label: tenantSettingsLabels.generalSectionTitle },
  { key: "relance", label: tenantSettingsLabels.relanceSectionTitle },
  { key: "appearance", label: tenantSettingsLabels.appearanceSectionTitle },
];

/** Onglets classiques : un seul panneau monté à la fois, chaque section
 * garde son propre mécanisme de sauvegarde (granulaire, cf. les composants
 * de section) — changer d'onglet démonte le panneau précédent. */
export function ParametresPanel({ initialSettings }: { initialSettings: TenantSettingsFull }) {
  const [activeTab, setActiveTab] = useState<ParametresTabKey>("general");

  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-4 lg:max-w-4xl">
      <h1 className="text-foreground text-lg font-semibold">{tenantSettingsLabels.pageTitle}</h1>

      <ParametresTabs active={activeTab} onChange={setActiveTab} tabs={TABS} />

      {activeTab === "general" ? (
        <GeneralSettingsForm
          displayName={initialSettings.displayName}
          currency={initialSettings.currency}
        />
      ) : null}

      {activeTab === "relance" ? (
        <RelanceSettingsForm
          reminderDays={initialSettings.reminderDays}
          whatsappTemplate={initialSettings.whatsappTemplate}
        />
      ) : null}

      {activeTab === "appearance" ? (
        <AppearanceSettingsSection
          brandColor={initialSettings.brandColor}
          logoUrl={initialSettings.logoUrl}
        />
      ) : null}
    </div>
  );
}
