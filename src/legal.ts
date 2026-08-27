export type LegalDocumentId = 'privacy' | 'terms' | 'permissions' | 'acknowledgements';
export type LegalLanguage = 'en' | 'da';

export interface LegalSection { heading: string; paragraphs: string[]; bullets?: string[]; }
export interface LegalDocument { title: string; summary: string; version: string; updated: string; url: string; sections: LegalSection[]; }

export const legalSiteUrl = 'https://tongzhen.github.io/house-care-legal';
export const supportEmail = 'support@housecare.example';
export const privacyEmail = 'privacy@housecare.example';

const common = { version: '0.1', updated: '19 August 2026' };

export const legalDocuments: Record<LegalLanguage, Record<LegalDocumentId, LegalDocument>> = {
  en: {
    privacy: {
      title: 'Privacy Policy', summary: 'How House Care handles information on your device.', url: `${legalSiteUrl}/privacy/`, ...common,
      sections: [
        { heading: 'Local-first', paragraphs: ['House Care has no account, analytics, advertising, or backend service. We do not collect or sell personal information.'] },
        { heading: 'Information stored on your device', paragraphs: ['Your selected home profile, action settings, completion history, issue notes, and optional issue photos stay in the app’s private storage on your device.'] },
        { heading: 'Optional device services', paragraphs: ['Notifications are scheduled locally. If you choose Open in calendar, House Care opens a prefilled event editor and you decide whether to save it. If you export a backup or PDF report, you choose the destination through the device share sheet.'], bullets: ['Photo access is requested only when you attach an issue photo.', 'House Care does not request access to your calendar.', 'Notification permission is requested only when local reminders are enabled.'] },
        { heading: 'Retention and deletion', paragraphs: ['Information remains on your device until you delete an issue, reset app data, or remove the app. Reset app data removes the local profile, history, and issue records; deleting the app is subject to your device backup settings.'] },
        { heading: 'Contact', paragraphs: [`House Care is currently published under a development identity. Before public release this policy will name the legal entity and postal address. Privacy questions: ${privacyEmail}.`] },
      ],
    },
    terms: {
      title: 'Terms of Use & Safety', summary: 'Important limits for using House Care.', url: `${legalSiteUrl}/terms/`, ...common,
      sections: [
        { heading: 'Informational guidance', paragraphs: ['House Care provides general routine-maintenance guidance. It is not a substitute for manufacturer instructions, an inspection, professional advice, or emergency services. Manufacturer and installer instructions always take priority.'] },
        { heading: 'Use safely', paragraphs: ['Only carry out tasks you can perform safely and stop if you notice a leak, burning smell, smoke, electrical risk, structural concern, or another danger. Contact a qualified professional when guidance says to do so.'] },
        { heading: 'Your responsibility', paragraphs: ['You decide whether a task is suitable for your home, equipment, skills, and local requirements. House Care does not guarantee that guidance is complete, current, or suitable for every installation.'] },
        { heading: 'Content and changes', paragraphs: ['House Care owns or licenses the app content and software. We may update these terms and the guidance with future releases.'] },
        { heading: 'Contact', paragraphs: [`Support: ${supportEmail}. Legal entity and address placeholders will be replaced before public release.`] },
      ],
    },
    permissions: {
      title: 'Data & permissions', summary: 'Why House Care asks for device access.', url: `${legalSiteUrl}/privacy/`, ...common,
      sections: [
        { heading: 'Notifications', paragraphs: ['Used to show local maintenance reminders at the days and times you choose. Disable them in House Care or your device settings.'] },
        { heading: 'Photos', paragraphs: ['Used only when you choose an image for an issue report. The selected image is copied into House Care’s private storage and can be deleted from the issue.'] },
        { heading: 'Calendar', paragraphs: ['Used only when you choose Open in calendar. House Care opens a prefilled event editor; you choose the calendar and decide whether to save. House Care cannot read, edit, or remove your calendar events.'] },
        { heading: 'Your controls', paragraphs: ['You can deny or revoke permissions in device settings. You can also reset app data from Settings to remove House Care’s local records.'] },
      ],
    },
    acknowledgements: {
      title: 'Acknowledgements & licences', summary: 'Open-source software and maintenance-content provenance.', url: `${legalSiteUrl}/acknowledgements/`, ...common,
      sections: [
        { heading: 'Open-source software', paragraphs: ['House Care includes open-source software. The complete package, copyright, licence, and licence-text notices are included below.'] },
        { heading: 'Maintenance guidance', paragraphs: ['Guidance is original editorial content. Before public release, every action is subject to source and safety review; manufacturer and installer instructions take priority.'] },
      ],
    },
  },
  da: {
    privacy: {
      title: 'Privatlivspolitik', summary: 'Sådan håndterer House Care oplysninger på din enhed.', url: `${legalSiteUrl}/privacy/`, ...common,
      sections: [
        { heading: 'Lokal først', paragraphs: ['House Care har ingen konto, analyse, annoncer eller backendtjeneste. Vi indsamler eller sælger ikke personoplysninger.'] },
        { heading: 'Oplysninger på din enhed', paragraphs: ['Din valgte boligprofil, opgaveindstillinger, historik, problemnoter og valgfrie billeder gemmes i appens private lager på din enhed.'] },
        { heading: 'Valgfrie enhedstjenester', paragraphs: ['Notifikationer planlægges lokalt. Hvis du vælger Føj til kalender, skriver House Care én begivenhed i den kalender, du vælger. Ved eksport af backup eller PDF vælger du selv destination i enhedens deleark.'], bullets: ['Adgang til billeder anmodes kun, når du vedhæfter et billede.', 'Kalenderadgang anmodes kun, når du føjer en opgave til kalenderen.', 'Notifikationstilladelse anmodes kun, når lokale påmindelser aktiveres.'] },
        { heading: 'Opbevaring og sletning', paragraphs: ['Oplysningerne bliver på din enhed, indtil du sletter et problem, nulstiller appdata eller fjerner appen. Nulstil appdata fjerner lokal profil, historik og problemregistreringer; sletning af appen afhænger af enhedens backupindstillinger.'] },
        { heading: 'Kontakt', paragraphs: [`House Care udgives foreløbigt under en udviklingsidentitet. Før offentlig udgivelse vil politikken angive juridisk enhed og postadresse. Spørgsmål om privatliv: ${privacyEmail}.`] },
      ],
    },
    terms: {
      title: 'Brugsvilkår og sikkerhed', summary: 'Vigtige begrænsninger ved brug af House Care.', url: `${legalSiteUrl}/terms/`, ...common,
      sections: [
        { heading: 'Generel vejledning', paragraphs: ['House Care giver generel vejledning om rutinemæssig vedligeholdelse. Den erstatter ikke producentens anvisninger, eftersyn, faglig rådgivning eller beredskab. Producentens og installatørens anvisninger har altid forrang.'] },
        { heading: 'Brug sikkert', paragraphs: ['Udfør kun opgaver, du kan udføre sikkert, og stop ved lækage, brændt lugt, røg, elektrisk risiko, konstruktionsproblemer eller anden fare. Kontakt en kvalificeret fagperson, når vejledningen siger det.'] },
        { heading: 'Dit ansvar', paragraphs: ['Du afgør selv, om en opgave passer til din bolig, dit udstyr, dine færdigheder og lokale krav. House Care garanterer ikke, at vejledningen er komplet, aktuel eller egnet til alle installationer.'] },
        { heading: 'Indhold og ændringer', paragraphs: ['House Care ejer eller har licens til appens indhold og software. Vi kan opdatere disse vilkår og vejledningen i fremtidige udgivelser.'] },
        { heading: 'Kontakt', paragraphs: [`Support: ${supportEmail}. Pladsholdere for juridisk enhed og adresse erstattes før offentlig udgivelse.`] },
      ],
    },
    permissions: {
      title: 'Data og tilladelser', summary: 'Hvorfor House Care beder om adgang til enheden.', url: `${legalSiteUrl}/privacy/`, ...common,
      sections: [
        { heading: 'Notifikationer', paragraphs: ['Bruges til lokale vedligeholdelsespåmindelser på de dage og tidspunkter, du vælger. Slå dem fra i House Care eller i enhedens indstillinger.'] },
        { heading: 'Billeder', paragraphs: ['Bruges kun, når du vælger et billede til en problemrapport. Det valgte billede kopieres til House Cares private lager og kan slettes fra problemet.'] },
        { heading: 'Kalender', paragraphs: ['Bruges kun, når du vælger Føj til kalender. House Care opretter én begivenhed i den kalender, du vælger, og ændrer eller sletter den ikke senere.'] },
        { heading: 'Dine valg', paragraphs: ['Du kan afvise eller tilbagekalde tilladelser i enhedens indstillinger. Du kan også nulstille appdata fra Indstillinger for at fjerne House Cares lokale poster.'] },
      ],
    },
    acknowledgements: {
      title: 'Anerkendelser og licenser', summary: 'Open-source-software og oprindelse af vedligeholdelsesindhold.', url: `${legalSiteUrl}/acknowledgements/`, ...common,
      sections: [
        { heading: 'Open source-software', paragraphs: ['House Care indeholder open source-software. De komplette oplysninger om pakke, ophavsret, licens og licenstekst vises nedenfor.'] },
        { heading: 'Vedligeholdelsesvejledning', paragraphs: ['Vejledningen er selvstændigt redaktionelt indhold. Før offentlig udgivelse gennemgår hver opgave kilde og sikkerhed; producentens og installatørens anvisninger har forrang.'] },
      ],
    },
  },
};
