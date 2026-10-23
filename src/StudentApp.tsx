import { useEffect, useState } from "react";
import {
  Apple,
  ArrowRight,
  ArrowUpRight,
  AtSign,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Download,
  Dumbbell,
  Flame,
  Info as InfoIcon,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  Save,
  ShieldCheck,
  UtensilsCrossed,
  UserRound,
  WifiOff,
  Zap,
} from "lucide-react";
import logo from "./assets/legado-mark.svg";
import "./student.css";

type Session = {
  id: string;
  username: string;
  name: string;
  role: "MEMBER";
  forcePasswordChange: boolean;
};
type Exercise = {
  exerciseName: string;
  sets: number;
  reps: string;
  load: string;
  restSeconds: number | null;
  notes: string;
};
type Plan = {
  name: string;
  objective: string;
  startDate: string;
  completedDayIds: string[];
  completedCount: number;
  currentStreak: number;
  weeks: Array<{
    weekNumber: number;
    days: Array<{
      id: string;
      name: string;
      muscleGroup: string;
      exercises: Exercise[];
    }>;
  }>;
};
type Diet = {
  name: string;
  objective: string;
  startDate: string;
  weeks: Array<{
    weekNumber: number;
    days: Array<{
      id: string;
      name: string;
      meals: Array<{
        id: string;
        name: string;
        items: Array<{
          foodName: string;
          quantity: string;
          grams: number | null;
          notes: string;
        }>;
      }>;
    }>;
  }>;
};
type Overview = {
  member: {
    firstName: string;
    lastName: string;
    phone: string;
    objective: string;
    startDate: string;
    endDate: string;
    inactive: boolean;
  };
  gym: {
    name: string;
    logoDataUrl: string | null;
    address: string;
    whatsapp: string;
    instagram: string;
    openingHours: string;
    mapsUrl: string;
  };
  plan: Plan | null;
  diet: Diet | null;
  forcePasswordChange: boolean;
};
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

const request = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Legado-Request": "1",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo completar la solicitud");
  }
  return response.status === 204 ? (undefined as T) : response.json();
};
const date = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));

function PasswordChange({
  onDone,
  onCancel,
  firstAccess = false,
}: {
  onDone: () => void;
  onCancel?: () => void;
  firstAccess?: boolean;
}) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canCancel = !firstAccess && Boolean(onCancel);

  useEffect(() => {
    if (!canCancel) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, canCancel, onCancel]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/auth/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      onDone();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cambiar la contraseña",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/80 p-5 backdrop-blur-sm"
      onMouseDown={() => {
        if (canCancel && !busy) onCancel?.();
      }}
    >
      <form
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900 p-7 text-white shadow-2xl"
      >
        <div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-lime-400 text-zinc-950">
          <ShieldCheck size={22} />
        </div>
        <h2 className="text-2xl font-black tracking-tight">
          {firstAccess ? "Protegé tu cuenta" : "Cambiar contraseña"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {firstAccess
            ? "Como es tu primer ingreso, elegí una contraseña personal."
            : "Ingresá tu contraseña actual y elegí una nueva de al menos 8 caracteres."}
        </p>
        <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-zinc-400">
          Contraseña actual
          <input
            required
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-800 px-4 py-3 text-base outline-none ring-lime-400 focus:ring-2"
          />
        </label>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-zinc-400">
          Nueva contraseña
          <input
            required
            minLength={8}
            type="password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-800 px-4 py-3 text-base outline-none ring-lime-400 focus:ring-2"
          />
        </label>
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        <div className="mt-6 grid gap-3">
          <button
            disabled={busy}
            className="w-full rounded-xl bg-lime-400 px-4 py-3 font-extrabold text-zinc-950 transition hover:bg-lime-300 disabled:opacity-50"
          >
            {busy ? "Guardando…" : "Guardar nueva contraseña"}
          </button>
          {canCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="w-full rounded-xl border border-white/15 px-4 py-3 font-bold text-zinc-200 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function StudentHome({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [page, setPage] = useState<
    "inicio" | "rutina" | "dieta" | "gimnasio" | "perfil"
  >("inicio");
  const [error, setError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const load = () =>
    request<Overview>("/student/overview")
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Error de conexión"),
      );
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const updateNetwork = () => setOffline(!navigator.onLine);
    const captureInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("online", updateNetwork); window.addEventListener("offline", updateNetwork); window.addEventListener("beforeinstallprompt", captureInstall);
    return () => { window.removeEventListener("online", updateNetwork); window.removeEventListener("offline", updateNetwork); window.removeEventListener("beforeinstallprompt", captureInstall); };
  }, []);
  async function install() { if (!installPrompt) return; await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }
  if (error)
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-950 p-6 text-center text-white">
        <div>
          <p>{error}</p>
          <button
            onClick={load}
            className="mt-4 rounded-xl bg-lime-400 px-5 py-3 font-bold text-zinc-950"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-950 text-sm font-semibold text-zinc-400">
        Cargando tu espacio…
      </div>
    );
  const content =
    page === "rutina" ? (
      <Routine plan={data.plan} onUpdated={load} />
    ) : page === "dieta" ? (
      <Nutrition diet={data.diet} />
    ) : page === "gimnasio" ? (
      <GymInfo gym={data.gym} />
    ) : page === "perfil" ? (
      <Profile
        data={data}
        username={session.username}
        onLogout={onLogout}
        onChangePassword={() => setPasswordOpen(true)}
        onSaved={() => void load()}
      />
    ) : (
      <Home data={data} go={setPage} />
    );
  return (
    <div className="student-shell min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              className="size-9 rounded-xl object-contain"
              src={data.gym.logoDataUrl || logo}
              alt=""
            />
            <div>
              <strong className="block text-sm tracking-wide">
                {data.gym.name.toUpperCase()}
              </strong>
              <span className="text-[10px] font-bold tracking-[.2em] text-lime-400">
                MI ESPACIO
              </span>
            </div>
          </div>
          <button
            onClick={() => setPage("perfil")}
            aria-label="Mi perfil"
            aria-current={page === "perfil" ? "page" : undefined}
            className="grid size-9 place-items-center rounded-full bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700"
          >
            <UserRound size={18} />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-5 pb-28 pt-6">{offline && <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs font-semibold text-amber-200"><WifiOff size={16}/> Sin conexión: mostramos tu información guardada.</div>}{page === "inicio" && installPrompt && <button onClick={() => void install()} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-lime-400/30 bg-lime-400/10 p-4 text-left"><span className="grid size-10 place-items-center rounded-xl bg-lime-400 text-zinc-950"><Download size={19}/></span><span className="flex-1"><strong className="block text-sm">Instalá Legado Gym</strong><small className="text-zinc-400">Accedé más rápido desde tu pantalla de inicio.</small></span><ChevronRight className="text-lime-400"/></button>}{content}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-zinc-900/95 px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(0,0,0,.22)] backdrop-blur">
        <div className="mx-auto flex max-w-lg justify-around">
          {(
            [
              { id: "inicio", icon: <Dumbbell size={19} />, label: "Inicio" },
              {
                id: "rutina",
                icon: <CalendarDays size={19} />,
                label: "Rutina",
              },
              { id: "dieta", icon: <Apple size={19} />, label: "Dieta" },
              { id: "gimnasio", icon: <MapPin size={19} />, label: "Gym" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex min-w-12 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-bold transition ${page === item.id ? "bg-lime-400/10 text-lime-400" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </nav>
      {data.forcePasswordChange && (
        <PasswordChange firstAccess onDone={() => void load()} />
      )}{" "}
      {passwordOpen && (
        <PasswordChange
          onDone={() => {
            setPasswordOpen(false);
            void load();
          }}
          onCancel={() => setPasswordOpen(false)}
        />
      )}
    </div>
  );
}

function Home({
  data,
  go,
}: {
  data: Overview;
  go: (page: "rutina" | "dieta") => void;
}) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const membershipStart = new Date(`${data.member.startDate.slice(0, 10)}T12:00:00`);
  const membershipEnd = new Date(`${data.member.endDate.slice(0, 10)}T12:00:00`);
  const daysLeft = Math.ceil((membershipEnd.getTime() - today.getTime()) / 86_400_000);
  const isPending = today < membershipStart;
  const isExpired = daysLeft < 0;
  const membershipStatus = data.member.inactive ? "Inactiva" : isPending ? "Pendiente" : isExpired ? "Vencida" : "Activa";
  const membershipAlert = data.member.inactive || isExpired || (!isPending && daysLeft < 7);
  const totalDuration = membershipEnd.getTime() - membershipStart.getTime();
  const progress = totalDuration > 0 ? Math.min(100, Math.max(0, ((today.getTime() - membershipStart.getTime()) / totalDuration) * 100)) : 0;
  const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(today).toLowerCase();
  const routineToday = data.plan?.weeks[activeWeekIndex(data.plan)]?.days.find((day) => dietDayLabel(day.name).toLowerCase() === weekday);
  const dietToday = data.diet?.weeks[currentDietWeek(data.diet)]?.days.find((day) => dietDayLabel(day.name).toLowerCase() === weekday);
  const renewalWhatsApp = data.gym.whatsapp.replace(/\D/g, "");
  const routineCompleted = !!routineToday && !!data.plan?.completedDayIds.includes(routineToday.id);
  return (
    <div className="student-dashboard space-y-4">
      <section className="pb-1 pt-1">
        <p className="student-display text-4xl font-black uppercase leading-none text-white">¡Hola, {data.member.firstName}! <span className="text-2xl" aria-hidden="true">👋</span></p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-400"><Zap size={16} className="shrink-0 text-[#c3f400]" /> Tu espacio para seguir avanzando.</p>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#444933] bg-[#1a2025] p-4 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <h2 className="student-display flex items-center gap-2 text-base font-bold uppercase tracking-wider"><CalendarDays size={17} className="text-[#c3f400]" /> Estado de membresía</h2>
          <span className={`rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${membershipAlert ? "border-orange-400/40 bg-orange-400/10 text-orange-300" : "border-[#c3f400]/40 bg-[#c3f400]/10 text-[#c3f400]"}`}>{membershipStatus}</span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-2"><strong className={`student-display text-5xl font-black leading-none ${membershipAlert ? "text-orange-300" : "text-[#c3f400]"}`}>{data.member.inactive || isExpired || isPending ? "—" : daysLeft}</strong><span className="student-display text-lg font-bold uppercase">{isPending ? "Por comenzar" : isExpired ? "Membresía vencida" : data.member.inactive ? "Sin vigencia" : daysLeft === 1 ? "día restante" : "días restantes"}</span></div>
          <div className="shrink-0 text-right"><span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Vigencia</span><span className="text-xs font-semibold text-zinc-200">Hasta {date(data.member.endDate)}</span></div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#090f14]" role="progressbar" aria-label="Tiempo transcurrido de la membresía" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div className={`h-full rounded-full ${membershipAlert ? "bg-orange-400" : "bg-[#c3f400]"}`} style={{ width: `${progress}%` }} /></div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/5 bg-[#161c21] p-3 text-xs leading-5 text-zinc-400"><InfoIcon size={17} className="mt-0.5 shrink-0 text-orange-400" /><p><strong className="text-zinc-200">{data.member.inactive ? "Tu membresía está inactiva." : isPending ? `Comienza el ${date(data.member.startDate)}.` : isExpired ? "Tu membresía está vencida." : daysLeft === 0 ? "Tu membresía vence hoy." : `Vence el ${date(data.member.endDate)}.`}</strong> Consultá en recepción por tu renovación.</p></div>
        {renewalWhatsApp && <a href={`https://wa.me/${renewalWhatsApp}?text=${encodeURIComponent("Hola, quiero consultar la renovación de mi membresía.")}`} target="_blank" rel="noreferrer" className="student-display mt-3 flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#444933] bg-[#2f353b] px-3 text-lg font-bold uppercase tracking-wide text-white no-underline transition hover:border-[#c3f400]"><MessageCircle size={18} className="text-[#c3f400]" /> Consultar renovación <ArrowUpRight size={14} className="text-zinc-400" /></a>}
      </section>

      {data.plan && <section className="grid grid-cols-2 divide-x divide-[#444933]/60 rounded-xl border border-[#444933] bg-[#1a2025] p-4"><div className="pr-3"><p className="student-display text-xs font-bold uppercase tracking-wider text-zinc-400">Racha actual</p><div className="mt-1 flex items-center gap-2"><Flame size={23} className="text-orange-400" /><strong className="student-display text-4xl font-black leading-none text-[#c3f400]">{data.plan.currentStreak}</strong><span className="student-display text-lg font-bold uppercase">días</span></div></div><div className="pl-4"><p className="student-display text-xs font-bold uppercase tracking-wider text-zinc-400">Tu progreso</p><strong className="student-display mt-1 block text-4xl font-black leading-none text-white">{data.plan.completedCount}</strong><p className="mt-1 text-xs text-[#c3f400]">entrenamientos completados</p></div></section>}

      <section className="overflow-hidden rounded-xl border border-[#444933] bg-[#1a2025] shadow-lg"><div className="h-1 bg-gradient-to-r from-[#c3f400] to-transparent" /><div className="space-y-4 p-4"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#c3f400]/30 bg-[#c3f400]/10 text-[#c3f400]"><Dumbbell size={20} /></span><div><p className="student-display text-xs font-bold uppercase tracking-wider text-zinc-400">Entrenamiento asignado</p><p className="student-display text-sm font-bold uppercase tracking-wide text-[#c3f400]">{routineToday ? `Hoy · ${dietDayLabel(routineToday.name)}` : "Tu rutina"}</p></div>{routineToday && <span className="ml-auto rounded border border-[#444933] bg-[#252b30] px-2 py-1 text-[10px] font-bold uppercase text-zinc-300">{routineCompleted ? "Completado" : "Pendiente"}</span>}</div><div><h2 className="student-display text-3xl font-bold uppercase leading-none text-white">{routineToday?.muscleGroup || data.plan?.name || "Sin rutina asignada"}</h2><p className="mt-2 text-xs text-zinc-400">{routineToday ? `${routineToday.exercises.length} ejercicios` : data.plan ? "Consultá los días de tu plan de entrenamiento." : "Tu entrenador podrá asignarte una rutina."}</p></div>{routineToday && routineToday.exercises.length > 0 && <div className="flex flex-wrap gap-2">{routineToday.exercises.slice(0, 3).map((exercise, index) => <span key={`${exercise.exerciseName}-${index}`} className="rounded-md border border-[#444933] bg-[#252b30] px-2 py-1 text-xs text-zinc-200"><span className="mr-1 text-[#c3f400]">•</span>{exercise.exerciseName}</span>)}{routineToday.exercises.length > 3 && <span className="rounded-md bg-[#090f14] px-2 py-1 text-xs text-zinc-400">+{routineToday.exercises.length - 3} más</span>}</div>}<button onClick={() => go("rutina")} className="student-display flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#c3f400] px-4 text-xl font-black uppercase tracking-wide text-[#161e00] transition hover:bg-[#d3ff38] active:scale-[.98]">Ver rutina completa <ArrowRight size={20} /></button></div></section>

      <section className="rounded-xl border border-[#444933] bg-[#1a2025] p-4 shadow-lg"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg border border-orange-400/30 bg-orange-400/10 text-orange-400"><UtensilsCrossed size={20} /></span><div><p className="student-display text-xs font-bold uppercase tracking-wider text-zinc-400">Plan nutricional</p><p className="student-display text-sm font-bold uppercase tracking-wide text-orange-300">Nutrición del día</p></div></div><h2 className="student-display mt-4 text-3xl font-bold uppercase leading-none text-white">{data.diet?.name || "Sin plan asignado"}</h2><p className="mt-2 text-xs leading-5 text-zinc-400">{data.diet?.objective || (data.diet ? "Tu plan de alimentación personalizado." : "Cuando el gimnasio cargue tu dieta, podrás consultarla acá.")}</p>{dietToday && <div className="mt-4 rounded-lg border-l-2 border-orange-400 bg-[#161c21] p-3"><p className="student-display text-xs font-bold uppercase tracking-wider text-orange-400">{dietDayLabel(dietToday.name)} · {dietToday.meals.length} comidas</p><p className="mt-1 text-sm text-zinc-200">{dietToday.meals.map((meal) => meal.name).join(" · ") || "Sin comidas cargadas"}</p></div>}<button onClick={() => go("dieta")} className="student-display mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-orange-400/40 bg-[#252b30] px-4 text-lg font-bold uppercase tracking-wide text-orange-300 transition hover:border-orange-400 active:scale-[.98]">Consultar plan de comidas <ArrowRight size={18} /></button></section>
    </div>
  );
}
function activeWeekIndex(plan: Plan) {
  const start = new Date(`${plan.startDate.slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.max(
    0,
    Math.min(
      plan.weeks.length - 1,
      Math.floor((today.getTime() - start.getTime()) / 604_800_000),
    ),
  );
}
function Routine({
  plan,
  onUpdated,
}: {
  plan: Plan | null;
  onUpdated: () => Promise<void>;
}) {
  const [dayIndex, setDayIndex] = useState(() => {
    if (!plan) return 0;
    const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(new Date()).toLowerCase();
    return Math.max(0, (plan.weeks[activeWeekIndex(plan)]?.days || []).findIndex((day) => dietDayLabel(day.name).toLowerCase() === weekday));
  });
  const [busyDay, setBusyDay] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!plan)
    return (
      <Empty
        icon={<Dumbbell />}
        text="Tu entrenador todavía no te asignó una rutina."
      />
    );
  const week = plan.weeks[activeWeekIndex(plan)];
  if (!week) return <Empty icon={<Dumbbell />} text="Todavía no hay días cargados en tu rutina." />;
  const day = week.days[Math.min(dayIndex, Math.max(0, week.days.length - 1))];
  async function toggleDay(dayId: string, completed: boolean) {
    setBusyDay(dayId);
    setError("");
    try {
      await request(`/student/routine/days/${dayId}/complete`, {
        method: completed ? "DELETE" : "POST",
      });
      await onUpdated();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar el progreso",
      );
    } finally {
      setBusyDay(null);
    }
  }
  const completed = day ? plan.completedDayIds.includes(day.id) : false;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="student-display max-w-full rounded border border-[#444933] bg-[#1a2025] px-3 py-1 text-sm font-bold uppercase tracking-wider text-[#c3f400]">{plan.name}</span>
        <span className="student-display flex items-center gap-1 text-sm font-bold uppercase text-zinc-300"><Flame size={16} className="text-orange-400" /> Racha: {plan.currentStreak} días</span>
      </div>
      <section aria-label="Días de entrenamiento">
        <div className="student-display mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider"><span className="text-zinc-400">Programación</span><span className="text-[#c3f400]">Período {week.weekNumber}</span></div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
          {week.days.map((value, index) => {
            const selected = index === Math.min(dayIndex, Math.max(0, week.days.length - 1));
            const done = plan.completedDayIds.includes(value.id);
            return <button key={value.id} type="button" onClick={() => setDayIndex(index)} aria-pressed={selected} className={`flex min-h-28 w-32 shrink-0 flex-col items-start rounded-lg border p-3 text-left transition ${selected ? "border-[#c3f400] bg-[#252b30] shadow-[0_0_16px_-4px_rgba(195,244,0,.35)]" : "border-[#444933] bg-[#161c21] hover:border-[#c3f400]/50"}`}><span className="student-display flex w-full items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400"><span>{dietDayLabel(value.name)}</span>{done && <Check size={15} className="text-[#c3f400]" />}</span><strong className={`student-display mt-2 text-lg font-bold uppercase leading-tight ${selected ? "text-[#c3f400]" : "text-zinc-200"}`}>{value.muscleGroup || `Día ${index + 1}`}</strong><span className="student-display mt-auto pt-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">{done ? "Completado" : "Pendiente"}</span></button>;
          })}
        </div>
      </section>
      {error && <p className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</p>}
      {day ? <>
        <section className="rounded-xl border border-[#444933] bg-[#1a2025] p-4 shadow-lg">
          <p className="student-display text-xs font-bold uppercase tracking-[.15em] text-[#c3f400]">Entrenamiento · {dietDayLabel(day.name)}</p>
          <h1 className="student-display mt-1 text-3xl font-black uppercase leading-none text-white">{day.muscleGroup || dietDayLabel(day.name)}</h1>
          <p className="mt-2 text-sm leading-5 text-zinc-400">{plan.objective || "Tu plan de entrenamiento personalizado."}</p>
          <div className="mt-4 grid grid-cols-2 divide-x divide-[#444933] rounded-lg border border-[#444933]/70 bg-[#090f14] py-3 text-center"><div><span className="student-display block text-xs font-bold uppercase tracking-wider text-zinc-400">Ejercicios</span><strong className="student-display text-xl font-bold text-[#c3f400]">{day.exercises.length}</strong></div><div><span className="student-display block text-xs font-bold uppercase tracking-wider text-zinc-400">Estado</span><strong className="student-display text-xl font-bold text-zinc-100">{completed ? "Completado" : "Pendiente"}</strong></div></div>
          <button type="button" disabled={busyDay !== null} onClick={() => void toggleDay(day.id, completed)} className={`student-display mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border px-3 text-lg font-black uppercase tracking-wide transition active:scale-[.98] ${completed ? "border-[#c3f400] bg-[#252b30] text-[#c3f400]" : "border-[#c3f400] bg-[#c3f400] text-[#161e00]"}`}><CalendarCheck size={19} />{busyDay === day.id ? "Guardando…" : completed ? "Día completado · Deshacer" : "Marcar día como completado"}</button>
        </section>
        <section aria-label="Rutina detallada" className="space-y-3"><div className="student-display flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wider text-zinc-400"><h2>Rutina detallada</h2><span>{day.exercises.length} {day.exercises.length === 1 ? "ejercicio" : "ejercicios"}</span></div>
          {day.exercises.length ? day.exercises.map((exercise, index) => <article key={`${exercise.exerciseName}-${index}`} className="rounded-xl border border-[#444933] bg-[#1a2025] p-4"><div className="flex items-start gap-3"><span className="student-display grid size-8 shrink-0 place-items-center rounded bg-[#c3f400] text-sm font-black text-[#161e00]">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0"><h3 className="student-display text-xl font-bold uppercase leading-tight text-white">{exercise.exerciseName}</h3>{day.muscleGroup && <p className="student-display mt-1 text-xs font-bold uppercase tracking-wider text-zinc-400">{day.muscleGroup}</p>}</div></div><div className="mt-3 grid grid-cols-3 divide-x divide-[#444933]/60 rounded-lg border border-[#444933]/70 bg-[#090f14] py-2 text-center"><div className="px-1"><span className="student-display block text-[11px] font-bold uppercase tracking-wider text-zinc-400">Series y reps</span><strong className="student-display text-base font-bold text-zinc-100">{exercise.sets} × {exercise.reps}</strong></div><div className="px-1"><span className="student-display block text-[11px] font-bold uppercase tracking-wider text-zinc-400">Carga</span><strong className="student-display text-base font-bold text-[#c3f400]">{exercise.load || "—"}</strong></div><div className="px-1"><span className="student-display block text-[11px] font-bold uppercase tracking-wider text-zinc-400">Descanso</span><strong className="student-display text-base font-bold text-zinc-100">{exercise.restSeconds != null ? `${exercise.restSeconds} s` : "—"}</strong></div></div>{exercise.notes && <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-zinc-400"><InfoIcon size={15} className="mt-0.5 shrink-0 text-[#c3f400]" />{exercise.notes}</p>}</article>) : <p className="rounded-xl border border-[#444933] bg-[#1a2025] p-4 text-sm text-zinc-400">No hay ejercicios cargados para este día.</p>}
        </section>
      </> : <Empty icon={<Dumbbell />} text="No hay días cargados para este período." />}
    </div>
  );
}
function dietDayLabel(value: string) {
  return value.split(/[·–—-]/)[0].trim();
}
function currentDietWeek(diet: Diet) {
  const start = new Date(`${diet.startDate.slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.max(
    0,
    Math.min(
      diet.weeks.length - 1,
      Math.floor((today.getTime() - start.getTime()) / 604_800_000),
    ),
  );
}
function Nutrition({ diet }: { diet: Diet | null }) {
  const [dayIndex, setDayIndex] = useState(() => {
    if (!diet) return 0;
    const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(new Date()).toLowerCase();
    return Math.max(0, (diet.weeks[currentDietWeek(diet)]?.days || []).findIndex((day) => dietDayLabel(day.name).toLowerCase() === weekday));
  });
  if (!diet)
    return (
      <Empty
        icon={<Apple />}
        text="Todavía no tenés un plan de alimentación asignado."
      />
    );
  const days = diet.weeks[currentDietWeek(diet)]?.days || [];
  const day = days[Math.min(dayIndex, Math.max(0, days.length - 1))];
  const selectedIndex = Math.min(dayIndex, Math.max(0, days.length - 1));
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-[#444933] bg-[#161c21] p-4">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-orange-500/10 blur-2xl" />
        <p className="student-display flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-orange-300"><UtensilsCrossed size={15} /> Alimentación personalizada</p>
        <h1 className="student-display mt-2 text-3xl font-black uppercase leading-none text-white">{diet.name}</h1>
        <p className="mt-2 text-sm leading-5 text-zinc-400">{diet.objective || "Tu plan de alimentación asignado por el gimnasio."}</p>
      </section>
      <section aria-label="Días de alimentación">
        <div className="student-display mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-400"><span>Seleccioná un día</span><span className="text-orange-300">Tu plan</span></div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
          {days.map((value, index) => <button key={value.id} type="button" onClick={() => setDayIndex(index)} aria-pressed={index === selectedIndex} className={`student-display min-h-11 shrink-0 rounded-lg border px-4 text-sm font-bold uppercase tracking-wide transition ${index === selectedIndex ? "border-[#c3f400] bg-[#c3f400] text-[#161e00] shadow-[0_0_14px_-4px_rgba(195,244,0,.4)]" : "border-[#444933] bg-[#161c21] text-zinc-300 hover:border-[#c3f400]/50"}`}>{dietDayLabel(value.name)}</button>)}
        </div>
      </section>
      {day ? <section aria-label={`Comidas para ${dietDayLabel(day.name)}`} className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1"><h2 className="student-display flex items-center gap-2 text-xl font-black uppercase tracking-wide text-white"><span className="h-4 w-1.5 rounded-sm bg-[#c3f400]" /> Comidas · {dietDayLabel(day.name)}</h2><span className="student-display shrink-0 text-xs font-bold uppercase tracking-wider text-zinc-400">{day.meals.length} {day.meals.length === 1 ? "comida" : "comidas"}</span></div>
        {day.meals.length ? day.meals.map((meal, mealIndex) => <article key={meal.id} className="overflow-hidden rounded-xl border border-[#444933] bg-[#161c21] p-4">
          <div className="flex items-center gap-3 border-b border-[#444933]/60 pb-3"><span className="student-display grid size-9 shrink-0 place-items-center rounded-lg border border-orange-400/30 bg-orange-400/10 text-sm font-black text-orange-300">{String(mealIndex + 1).padStart(2, "0")}</span><div><p className="student-display text-[11px] font-bold uppercase tracking-[.15em] text-orange-300">Comida {mealIndex + 1}</p><h3 className="student-display text-xl font-bold uppercase leading-tight text-white">{meal.name}</h3></div></div>
          {meal.items.length ? <ul className="mb-0 mt-3 list-none space-y-3 p-0">{meal.items.map((food, i) => {
            const grams = food.grams != null ? `${food.grams} g` : "";
            const includesGrams = food.grams != null && new RegExp(`(?:^|\\s)${food.grams}\\s*(?:g|gr|gramos)\\b`, "i").test(food.quantity);
            const portion = [food.quantity, !includesGrams && grams].filter(Boolean).join(" · ");
            return <li key={`${food.foodName}-${i}`} className="flex items-start gap-2.5"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[#c3f400]" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-5 text-zinc-200">{food.foodName}</p>{food.notes && <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-zinc-400"><InfoIcon size={13} className="mt-0.5 shrink-0 text-orange-300" />{food.notes}</p>}</div>{portion && <span className="max-w-[45%] rounded border border-[#444933]/70 bg-[#252b30] px-2 py-1 text-right text-xs font-bold leading-4 text-[#c3f400]">{portion}</span>}</li>;
          })}</ul> : <p className="mt-3 text-sm text-zinc-400">No hay alimentos cargados para esta comida.</p>}
        </article>) : <p className="rounded-xl border border-[#444933] bg-[#1a2025] p-4 text-sm text-zinc-400">No hay comidas cargadas para este día.</p>}
      </section> : <Empty icon={<Apple />} text="No hay comidas cargadas para este día." />}
    </div>
  );
}
function GymInfo({ gym }: { gym: Overview["gym"] }) {
  const whatsapp = gym.whatsapp.replace(/\D/g, "");
  const instagram = gym.instagram.replace(/^@/, "");
  const maps =
    gym.mapsUrl ||
    (gym.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gym.address)}`
      : "");
  const hours = gym.openingHours.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-xl border border-[#444933] bg-[#1a2025] shadow-lg">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-[#c3f400]/10 blur-3xl" />
        <div className="relative flex items-center gap-4 border-b border-[#444933]/60 bg-gradient-to-br from-[#252b30] to-[#090f14] p-5">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#c3f400]/35 bg-[#090f14] p-2"><img className="size-full object-contain" src={gym.logoDataUrl || logo} alt="" /></span>
          <div className="min-w-0"><p className="student-display m-0 text-xs font-bold uppercase tracking-[.15em] text-[#c3f400]">Tu espacio de entrenamiento</p><h1 className="student-display mb-0 mt-1 text-4xl font-black uppercase leading-none text-white">{gym.name}</h1></div>
        </div>
        <div className="flex items-start gap-2 p-4 text-sm text-zinc-300"><MapPin size={17} className="mt-0.5 shrink-0 text-[#c3f400]" /><span>{gym.address || "Dirección aún no disponible"}</span></div>
      </section>

      {(whatsapp || instagram || maps) && <section aria-labelledby="gym-contact-title" className="space-y-3">
        <h2 id="gym-contact-title" className="student-display m-0 flex items-center gap-2 text-xl font-bold uppercase tracking-wide text-white"><Zap size={19} className="text-[#c3f400]" /> Canales de contacto</h2>
        {whatsapp && <a className="group flex min-h-20 items-center gap-3 rounded-xl border border-[#c3f400]/60 bg-gradient-to-r from-[#252b30] to-[#1a2025] p-4 text-white no-underline shadow-[0_0_18px_-8px_rgba(195,244,0,.4)] transition hover:border-[#c3f400] active:scale-[.98]" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#c3f400] text-[#161e00]"><MessageCircle size={22} /></span><span className="min-w-0 flex-1"><strong className="student-display block text-xl font-black uppercase leading-tight text-[#c3f400]">Abrir WhatsApp</strong><span className="mt-1 block text-xs leading-4 text-zinc-400">Consultas y renovación de membresía</span></span><ArrowUpRight size={20} className="shrink-0 text-[#c3f400]" /></a>}
        <div className="grid grid-cols-2 gap-3">
          {instagram && <a className={`group flex min-h-32 flex-col rounded-xl border border-[#444933] bg-[#1a2025] p-4 text-white no-underline transition hover:border-orange-300/60 active:scale-[.98] ${!maps ? "col-span-2" : ""}`} href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer"><span className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-lg bg-orange-300/10 text-orange-300"><AtSign size={19} /></span><ArrowUpRight size={16} className="text-zinc-500" /></span><span className="student-display mt-3 block text-xs font-bold uppercase tracking-wider text-zinc-400">Instagram oficial</span><strong className="student-display mt-1 block break-all text-xl font-bold leading-tight text-white">@{instagram}</strong></a>}
          {maps && <a className={`group flex min-h-32 flex-col rounded-xl border border-[#444933] bg-[#1a2025] p-4 text-white no-underline transition hover:border-[#c3f400]/60 active:scale-[.98] ${!instagram ? "col-span-2" : ""}`} href={maps} target="_blank" rel="noreferrer"><span className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-lg bg-[#c3f400]/10 text-[#c3f400]"><Navigation size={19} /></span><ArrowUpRight size={16} className="text-zinc-500" /></span><span className="student-display mt-3 block text-xs font-bold uppercase tracking-wider text-zinc-400">Ubicación</span><strong className="student-display mt-1 block text-xl font-bold uppercase leading-tight text-white">Cómo llegar</strong></a>}
        </div>
      </section>}

      {hours.length > 0 && <section aria-labelledby="gym-hours-title" className="space-y-3"><h2 id="gym-hours-title" className="student-display m-0 flex items-center gap-2 text-xl font-bold uppercase tracking-wide text-white"><Clock3 size={19} className="text-[#c3f400]" /> Horarios de entrenamiento</h2><div className="divide-y divide-[#444933]/60 overflow-hidden rounded-xl border border-[#444933] bg-[#1a2025]">{hours.map((line, index) => <div key={`${line}-${index}`} className="flex items-start gap-3 px-4 py-3.5"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#c3f400]" /><p className="m-0 text-sm leading-6 text-zinc-200">{line}</p></div>)}</div></section>}

      {maps && <section aria-labelledby="gym-location-title" className="space-y-3"><h2 id="gym-location-title" className="student-display m-0 flex items-center gap-2 text-xl font-bold uppercase tracking-wide text-white"><MapPin size={19} className="text-[#c3f400]" /> Ubicación del gimnasio</h2><div className="rounded-xl border border-[#444933] bg-[#161c21] p-4"><p className="m-0 text-sm leading-6 text-zinc-300">{gym.address || "Abrí el enlace para consultar la ubicación."}</p><a href={maps} target="_blank" rel="noreferrer" className="student-display mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#c3f400]/50 bg-[#c3f400]/10 px-3 text-sm font-bold uppercase tracking-wide text-[#c3f400] no-underline transition hover:bg-[#c3f400]/20"><Navigation size={16} /> Abrir en Google Maps <ArrowUpRight size={15} /></a></div></section>}
      {!gym.address && !hours.length && !whatsapp && !instagram && !maps && <p className="rounded-xl border border-[#444933] bg-[#1a2025] p-4 text-sm text-zinc-400">El gimnasio todavía no cargó su información de contacto.</p>}
    </div>
  );
}
function Profile({
  data,
  username,
  onLogout,
  onChangePassword,
  onSaved,
}: {
  data: Overview;
  username: string;
  onLogout: () => void;
  onChangePassword: () => void;
  onSaved: () => void;
}) {
  const [phone, setPhone] = useState(data.member.phone);
  const [editingPhone, setEditingPhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function savePhone(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/student/profile", {
        method: "PUT",
        body: JSON.stringify({ phone }),
      });
      setNotice("Teléfono actualizado.");
      setEditingPhone(false);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(`${data.member.startDate.slice(0, 10)}T12:00:00`);
  const end = new Date(`${data.member.endDate.slice(0, 10)}T12:00:00`);
  const status = data.member.inactive ? "Inactiva" : today < start ? "Pendiente" : today > end ? "Vencida" : "Activa";
  const initials = `${data.member.firstName[0] || ""}${data.member.lastName[0] || ""}`.toLocaleUpperCase("es-AR");
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-[#444933] bg-[#1a2025] p-4 shadow-lg">
        <div className="flex items-center gap-4"><span aria-hidden="true" className="student-display grid size-16 shrink-0 place-items-center rounded-xl border border-[#c3f400]/60 bg-[#c3f400]/10 text-2xl font-black text-[#c3f400]">{initials}</span><div className="min-w-0"><p className="student-display m-0 text-xs font-bold uppercase tracking-[.15em] text-[#c3f400]">Mi perfil</p><h1 className="student-display mb-0 mt-1 break-words text-3xl font-black uppercase leading-none text-white">{data.member.firstName} {data.member.lastName}</h1><p className="mb-0 mt-1 text-xs text-zinc-400">Alumno de {data.gym.name}</p></div></div>
        <div className="mt-4 border-t border-[#444933]/60 pt-3"><p className="student-display m-0 text-xs font-bold uppercase tracking-wider text-zinc-400">Mi objetivo</p><p className="mb-0 mt-1 text-sm leading-5 text-zinc-200">{data.member.objective || "Sin objetivo registrado"}</p></div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#444933] bg-[#090f14] px-3 py-2"><span className="student-display text-xs font-bold uppercase tracking-wider text-zinc-400">Membresía · vence {date(data.member.endDate)}</span><span className={`student-display shrink-0 text-sm font-bold uppercase ${status === "Activa" ? "text-[#c3f400]" : "text-orange-300"}`}>{status}</span></div>
      </section>

      {data.plan && <section aria-label="Progreso de entrenamiento" className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-[#444933] bg-[#1a2025] p-3"><Flame size={18} className="text-orange-400" /><strong className="student-display mt-2 block text-2xl font-black leading-none text-white">{data.plan.currentStreak} días</strong><span className="mt-1 block text-xs text-zinc-400">Racha actual</span></div><div className="rounded-xl border border-[#444933] bg-[#1a2025] p-3"><CalendarCheck size={18} className="text-[#c3f400]" /><strong className="student-display mt-2 block text-2xl font-black leading-none text-white">{data.plan.completedCount}</strong><span className="mt-1 block text-xs text-zinc-400">Entrenamientos completados</span></div></section>}

      <section aria-labelledby="profile-details" className="space-y-3"><h2 id="profile-details" className="student-display m-0 flex items-center gap-2 text-xl font-bold uppercase tracking-wide text-white"><UserRound size={19} className="text-[#c3f400]" /> Datos personales</h2><div className="space-y-4 rounded-xl border border-[#444933] bg-[#1a2025] p-4"><div><p className="student-display m-0 text-xs font-bold uppercase tracking-wider text-zinc-400">Nombre completo</p><p className="mb-0 mt-1 rounded-lg border border-[#444933] bg-[#090f14] px-3 py-3 text-sm text-zinc-200">{data.member.firstName} {data.member.lastName}</p></div><div><p className="student-display m-0 text-xs font-bold uppercase tracking-wider text-zinc-400">Usuario de acceso</p><p className="mb-0 mt-1 rounded-lg border border-[#444933] bg-[#090f14] px-3 py-3 text-sm text-zinc-200">{username}</p></div><div><div className="flex items-center justify-between gap-2"><p className="student-display m-0 text-xs font-bold uppercase tracking-wider text-zinc-400">Teléfono</p>{!editingPhone && <button type="button" onClick={() => { setPhone(data.member.phone); setNotice(""); setError(""); setEditingPhone(true); }} className="student-display rounded border border-[#444933] bg-[#252b30] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#c3f400]">Editar</button>}</div>{editingPhone ? <form onSubmit={savePhone} className="mt-2"><label htmlFor="profile-phone" className="sr-only">Teléfono</label><input id="profile-phone" required maxLength={50} type="tel" autoComplete="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setError(""); }} className="w-full rounded-lg border border-[#444933] bg-[#090f14] px-3 py-3 text-base text-white outline-none ring-[#c3f400] focus:ring-2" />{error && <p className="mb-0 mt-2 text-sm text-red-300" role="alert">{error}</p>}<div className="mt-3 flex gap-2"><button type="submit" disabled={busy || !phone.trim() || phone.trim() === data.member.phone} className="student-display flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#c3f400] px-3 text-base font-bold uppercase text-[#161e00]"><Save size={16} />{busy ? "Guardando…" : "Guardar"}</button><button type="button" disabled={busy} onClick={() => { setPhone(data.member.phone); setError(""); setEditingPhone(false); }} className="student-display min-h-11 rounded-lg border border-[#444933] bg-[#252b30] px-4 text-base font-bold uppercase text-zinc-200">Cancelar</button></div></form> : <p className="mb-0 mt-1 rounded-lg border border-[#444933] bg-[#090f14] px-3 py-3 text-sm text-zinc-200">{data.member.phone || "Sin teléfono registrado"}</p>}{notice && <p className="mb-0 mt-2 text-sm text-[#c3f400]" role="status">{notice}</p>}</div><p className="m-0 text-xs leading-5 text-zinc-500">Para modificar tu nombre o usuario, consultá en recepción.</p></div></section>

      <section aria-labelledby="profile-security" className="space-y-3"><h2 id="profile-security" className="student-display m-0 flex items-center gap-2 text-xl font-bold uppercase tracking-wide text-white"><ShieldCheck size={19} className="text-[#c3f400]" /> Seguridad y acceso</h2><div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#444933] bg-[#1a2025] p-4"><span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#444933] bg-[#090f14] text-[#c3f400]"><KeyRound size={19} /></span><div className="min-w-0 flex-1"><strong className="student-display block text-lg font-bold uppercase text-white">Contraseña de alumno</strong><span className="text-xs text-zinc-400">Actualizá tu contraseña personal.</span></div><button type="button" onClick={onChangePassword} className="student-display min-h-10 rounded-lg border border-[#444933] bg-[#252b30] px-3 text-sm font-bold uppercase tracking-wide text-[#c3f400]">Cambiar</button></div></section>
      <button type="button" onClick={onLogout} className="student-display flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-400/10 px-4 text-lg font-bold uppercase tracking-wide text-red-300 transition hover:bg-red-400/20"><LogOut size={18} /> Cerrar sesión</button>
    </div>
  );
}
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="mt-20 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-zinc-800 text-lime-400">
        {icon}
      </span>
      <h1 className="mt-5 text-2xl font-black">Aún no hay contenido</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
    </div>
  );
}

export function StudentGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js");
  }, []);
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (value?.role === "MEMBER") setSession(value);
      })
      .finally(() => setChecking(false));
  }, []);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request<Session>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (data.role !== "MEMBER")
        throw new Error("Este acceso es solo para alumnos.");
      setSession(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo ingresar");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_STUDENT_CACHE" });
      setSession(null);
    }
  }
  if (checking)
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-400">
        Cargando…
      </div>
    );
  if (session)
    return <StudentHome session={session} onLogout={() => void logout()} />;
  return (
    <main className="student-shell grid min-h-screen place-items-center bg-zinc-950 p-5 text-white">
      <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-zinc-900 p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <img src={logo} className="size-12 rounded-2xl" alt="Legado Gym" />
          <div>
            <strong className="block tracking-wide">LEGADO GYM</strong>
            <small className="font-bold tracking-[.17em] text-lime-400">
              ESPACIO ALUMNOS
            </small>
          </div>
        </div>
        <h1 className="mt-9 text-3xl font-black tracking-tight">
          Tu entrenamiento,
          <br />
          siempre con vos.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Ingresá con tu DNI y la contraseña entregada por el gimnasio.
        </p>
        <form onSubmit={login} className="mt-7">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            DNI
            <input
              required
              inputMode="numeric"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\D/g, ""))}
              className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-800 px-4 py-3 outline-none ring-lime-400 focus:ring-2"
              placeholder="Sin puntos"
            />
          </label>
          <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-zinc-400">
            Contraseña
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-800 px-4 py-3 outline-none ring-lime-400 focus:ring-2"
            />
          </label>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          <button
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-3 font-extrabold text-zinc-950 transition hover:bg-lime-300 disabled:opacity-50"
          >
            {busy ? (
              "Ingresando…"
            ) : (
              <>
                Ingresar <KeyRound size={17} />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
