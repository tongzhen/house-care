import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: { translation: {
    home: 'Home', actions: 'Actions', history: 'History', settings: 'Settings', welcome: 'Make care fit your home.', setupHint: 'Choose what you have. You can change this later.', continue: 'Continue', dishwasher: 'Dishwasher', washingMachine: 'Washing machine', tumbleDryer: 'Tumble dryer', cookerHood: 'Cooker hood', whatMatters: 'What matters now', upcoming: 'Coming up', viewSteps: 'View safe steps', dueNow: 'Due now', why: 'Why this matters', safeSteps: 'Safe steps', normal: 'Normal signs', concerning: 'Concerning signs', stop: 'Stop and get help', done: 'Mark as done', snooze: 'Snooze', notRelevant: 'Not relevant', issue: 'I noticed an issue', completed: 'Completed', nextDue: 'Next due', noHistory: 'Your completed tasks and issue notes will appear here.', frequency: 'Frequency', reset: 'Reset to default', disable: 'Disable action', enable: 'Enable action', language: 'Language', notifications: 'Local notifications', save: 'Save', cancel: 'Cancel', issueTitle: 'Record an issue', issueHint: 'Describe what you noticed. Do not attempt a repair.', note: 'Optional note', addPhoto: 'Add photo', submit: 'Save issue', noTasks: 'Nothing needs your attention right now.', editHome: 'Edit home profile', tomorrow: 'Tomorrow', oneWeek: 'In one week', chooseDate: 'Choose date'
  }},
  da: { translation: {
    home: 'Hjem', actions: 'Opgaver', history: 'Historik', settings: 'Indstillinger', welcome: 'Tilpas vedligeholdelsen til dit hjem.', setupHint: 'Vælg det, du har. Du kan ændre det senere.', continue: 'Fortsæt', dishwasher: 'Opvaskemaskine', washingMachine: 'Vaskemaskine', tumbleDryer: 'Tørretumbler', cookerHood: 'Emhætte', whatMatters: 'Det vigtigste lige nu', upcoming: 'På vej', viewSteps: 'Se sikre trin', dueNow: 'Skal gøres nu', why: 'Derfor er det vigtigt', safeSteps: 'Sikre trin', normal: 'Normale tegn', concerning: 'Tegn på et problem', stop: 'Stop og få hjælp', done: 'Markér som udført', snooze: 'Udsæt', notRelevant: 'Ikke relevant', issue: 'Jeg har bemærket et problem', completed: 'Udført', nextDue: 'Næste gang', noHistory: 'Dine udførte opgaver og noter om problemer vises her.', frequency: 'Hyppighed', reset: 'Nulstil til standard', disable: 'Deaktivér opgave', enable: 'Aktivér opgave', language: 'Sprog', notifications: 'Lokale påmindelser', save: 'Gem', cancel: 'Annuller', issueTitle: 'Notér et problem', issueHint: 'Beskriv det, du har set. Forsøg ikke selv at reparere det.', note: 'Valgfri note', addPhoto: 'Tilføj foto', submit: 'Gem problem', noTasks: 'Intet kræver din opmærksomhed lige nu.', editHome: 'Redigér hjemprofil', tomorrow: 'I morgen', oneWeek: 'Om en uge', chooseDate: 'Vælg dato'
  }}
};

// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({ resources, lng: 'en', fallbackLng: 'en', interpolation: { escapeValue: false } });
export default i18n;
