import { useState, useCallback, useEffect } from "react"

// ── Constants ─────────────────────────────────────────────────────────────
const COLORS = [
	{
		id: "yellow",
		label: "Jaune",
		points: 2,
		ball: "#e8c832",
		text: "#1a1a1a",
	},
	{ id: "green", label: "Verte", points: 3, ball: "#2db34a", text: "#fff" },
	{ id: "brown", label: "Marron", points: 4, ball: "#7a3e18", text: "#fff" },
	{ id: "blue", label: "Bleue", points: 5, ball: "#1a6ec7", text: "#fff" },
	{ id: "pink", label: "Rose", points: 6, ball: "#e05878", text: "#fff" },
	{ id: "black", label: "Noire", points: 7, ball: "#1c1c1c", text: "#fff" },
]
const REDS_TOTAL = 15
const FOUL_MIN = 4

function calcMaxRemaining(reds, colorsOnTable) {
	if (reds > 0)
		return reds * (1 + 7) + colorsOnTable.reduce((s, c) => s + c.points, 0)
	return colorsOnTable.reduce((s, c) => s + c.points, 0)
}

// ── State factory ─────────────────────────────────────────────────────────
function makeInitialState(p1, p2) {
	return {
		players: [
			{ name: p1, score: 0 },
			{ name: p2, score: 0 },
		],
		currentPlayer: 0,
		redsLeft: REDS_TOTAL,
		colorsOnTable: [...COLORS],
		phase: "red",
		consecutivePots: 0,
		extraReds: 0,
		history: [],
		frameOver: false,
		winner: null,
		missMode: false,
		missTargetMode: false,
		missFoulValue: 0,
		missContactType: null,
		message: null,
	}
}

// ── Game logic ────────────────────────────────────────────────────────────
function applyShot(state, action) {
	const s = JSON.parse(JSON.stringify(state))
	const cur = s.currentPlayer
	const opp = 1 - cur

	if (action.type === "pot_red") {
		s.redsLeft = Math.max(0, s.redsLeft - 1)
		s.players[cur].score += 1
		s.phase = "color"
		s.extraReds = 0
		s.consecutivePots += 1
		s.message = "Rouge empochée — jouez une couleur."
	} else if (action.type === "add_extra_red") {
		if (s.redsLeft > 1) {
			s.extraReds = (s.extraReds || 0) + 1
			s.redsLeft = Math.max(0, s.redsLeft - 1)
			s.players[cur].score += 1
			s.message = `+${s.extraReds} rouge${s.extraReds > 1 ? "s" : ""} bonus — choisissez la couleur.`
		}
	} else if (action.type === "pot_color") {
		const ball = action.ball
		const extras = s.extraReds || 0
		s.extraReds = 0
		s.players[cur].score += ball.points
		s.consecutivePots += 1
		const extrasLabel =
			extras > 0
				? ` (+ ${extras} rouge${extras > 1 ? "s" : ""} bonus)`
				: ""
		if (s.phase === "endgame") {
			s.colorsOnTable = s.colorsOnTable.filter((c) => c.id !== ball.id)
			if (s.colorsOnTable.length === 0) {
				s.frameOver = true
				const [sc0, sc1] = [s.players[0].score, s.players[1].score]
				s.winner = sc0 > sc1 ? 0 : sc1 > sc0 ? 1 : null
				s.message =
					s.winner !== null
						? `${s.players[s.winner].name} remporte la frame !`
						: "Égalité !"
			} else {
				s.message = `${ball.label} empochée — prochaine : ${s.colorsOnTable[0].label}`
			}
		} else {
			if (s.redsLeft === 0) {
				s.phase = "endgame"
				s.message = `${ball.label} empochée — phase finale !`
			} else {
				s.phase = "red"
				s.message = `${ball.label} empochée — jouez une rouge`
			}
		}
	} else if (action.type === "miss") {
		s.missTargetMode = true
		s.missContactType = null
		s.message = null
	} else if (action.type === "miss_set_target") {
		const foulVal = Math.max(FOUL_MIN, action.ballPoints)
		s.players[opp].score += foulVal
		s.missFoulValue = foulVal
		s.missContactType = action.contact
		if (action.contact === "wrong_red" && s.redsLeft > 0) {
			s.redsLeft = Math.max(0, s.redsLeft - 1)
		}
		s.missTargetMode = false
		s.missMode = true
		const contactLabel =
			action.contact === "nothing"
				? "sans contact"
				: action.contact === "wrong_red"
					? "mauvaise rouge rentrée"
					: `mauvaise bille (${action.ballLabel})`
		s.message = `Miss (${contactLabel}) — ${s.players[opp].name} reçoit ${foulVal} pts.`
	} else if (action.type === "miss_replay") {
		s.missMode = false
		s.missFoulValue = 0
		s.message = `${s.players[s.currentPlayer].name} rejoue.`
	} else if (action.type === "miss_accept") {
		s.missMode = false
		s.missFoulValue = 0
		s.currentPlayer = opp
		s.consecutivePots = 0
		if (s.phase === "endgame") {
			// stays in endgame
		} else if (s.redsLeft === 0) {
			s.phase = "endgame"
		} else {
			s.phase = "red"
		}
		const nextBallA =
			s.phase === "endgame" && s.colorsOnTable.length > 0
				? ` → ${s.colorsOnTable[0].label}`
				: ""
		s.message = `${s.players[opp].name} joue.${nextBallA}`
	} else if (action.type === "foul_red") {
		s.players[opp].score += FOUL_MIN
		s.redsLeft = Math.max(0, s.redsLeft - 1)
		s.currentPlayer = opp
		s.consecutivePots = 0
		if (s.redsLeft === 0) {
			s.phase = "endgame"
			const nextBallR =
				s.colorsOnTable.length > 0
					? ` → ${s.colorsOnTable[0].label}`
					: ""
			s.message = `Faute (rouge rentrée) — ${s.players[opp].name} reçoit 4 pts. Plus de rouges.${nextBallR}`
		} else {
			s.phase = "red"
			s.message = `Faute (rouge rentrée) — ${s.players[opp].name} reçoit 4 pts. ${s.redsLeft} rouge${s.redsLeft > 1 ? "s" : ""} restante${s.redsLeft > 1 ? "s" : ""}.`
		}
	} else if (action.type === "foul") {
		const awarded = Math.max(FOUL_MIN, action.value)
		s.players[opp].score += awarded
		s.currentPlayer = opp
		s.consecutivePots = 0
		if (s.phase === "endgame") {
			// stays in endgame
		} else if (s.redsLeft === 0) {
			s.phase = "endgame"
		} else {
			s.phase = "red"
		}
		const nextBallF =
			s.phase === "endgame" && s.colorsOnTable.length > 0
				? ` → ${s.colorsOnTable[0].label}`
				: ""
		s.message = `Faute — ${s.players[opp].name} reçoit ${awarded} pts.${nextBallF}`
	} else if (action.type === "end_break") {
		s.currentPlayer = opp
		s.consecutivePots = 0
		if (s.phase === "endgame") {
			// stays in endgame
		} else if (s.redsLeft === 0) {
			s.phase = "endgame"
		} else {
			s.phase = "red"
		}
		const nextBallE =
			s.phase === "endgame" && s.colorsOnTable.length > 0
				? ` → ${s.colorsOnTable[0].label}`
				: ""
		s.message = `${s.players[opp].name} joue.${nextBallE}`
	}

	return s
}

// ── Ball components ───────────────────────────────────────────────────────
function Ball3D({ ball, onClick, disabled, size = 60 }) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			title={`${ball.label} — ${ball.points} pt${ball.points > 1 ? "s" : ""}`}
			className={[
				"rounded-full border-0 p-0 flex items-center justify-center shrink-0",
				"transition-transform duration-120",
				disabled
					? "opacity-25 cursor-not-allowed"
					: "cursor-pointer hover:scale-110 hover:-translate-y-0.5 active:scale-95",
			].join(" ")}
			style={{
				width: size,
				height: size,
				background: ball.ball,
				boxShadow: disabled ? "none" : "0 2px 8px rgba(0,0,0,0.28)",
			}}
		>
			<span
				className="font-extrabold leading-none tracking-tight"
				style={{ color: ball.text, fontSize: size * 0.3 }}
			>
				{ball.points}
			</span>
		</button>
	)
}

function RedBall3D({ onClick, disabled, size = 72, label = "1" }) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={[
				"rounded-full border-0 p-0 flex items-center justify-center",
				"transition-transform duration-120",
				disabled
					? "opacity-25 cursor-not-allowed"
					: "cursor-pointer hover:scale-[1.12] hover:-translate-y-0.5 active:scale-95",
			].join(" ")}
			style={{
				width: size,
				height: size,
				background: "#d42020",
				boxShadow: disabled ? "none" : "0 2px 10px rgba(0,0,0,0.3)",
			}}
		>
			<span
				className="text-white font-extrabold leading-none"
				style={{ fontSize: size * 0.32 }}
			>
				{label}
			</span>
		</button>
	)
}

// ── Reusable UI ───────────────────────────────────────────────────────────
function Card({
	children,
	className = "",
	borderClass = "border border-black/7 dark:border-white/8",
}) {
	return (
		<div
			className={`bg-white dark:bg-slate-900 rounded-[20px] p-[18px_16px] ${borderClass} ${className}`}
		>
			{children}
		</div>
	)
}

function SectionLabel({ children }) {
	return (
		<div className="text-[10px] font-extrabold tracking-[0.16em] uppercase text-gray-400 dark:text-slate-500 mb-3 text-center">
			{children}
		</div>
	)
}

function Btn({
	children,
	onClick,
	disabled,
	variant = "default",
	className = "",
}) {
	const base =
		"border rounded-xl px-[10px] py-[11px] font-bold text-[13px] font-[inherit] transition-transform duration-120"
	const states = disabled
		? "opacity-30 cursor-not-allowed"
		: "cursor-pointer hover:-translate-y-px active:scale-[0.97]"
	const variants = {
		default:
			"bg-white dark:bg-slate-900 border-black/7 dark:border-white/8 text-gray-500 dark:text-slate-300",
		warn: "bg-orange-500/[0.09] border-orange-500/30 text-amber-600 dark:text-amber-400",
		success:
			"bg-green-500/[0.09] border-green-500/30 text-green-700 dark:text-green-400",
	}
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={`${base} ${states} ${variants[variant] || variants.default} ${className}`}
		>
			{children}
		</button>
	)
}

function HistoryLog({ history }) {
	if (!history.length) return null
	return (
		<div className="mt-4 rounded-2xl overflow-hidden bg-black/3 dark:bg-white/3 border border-black/6 dark:border-white/7">
			<div className="text-[10px] font-extrabold tracking-[0.15em] uppercase text-gray-400 dark:text-slate-500 px-[14px] pt-[10px] pb-[6px]">
				Historique
			</div>
			<div className="max-h-[150px] overflow-y-auto px-[14px] pb-[10px]">
				{[...history].reverse().map((h, i) => (
					<div
						key={i}
						className="text-xs text-gray-500 dark:text-slate-400 py-[3px] flex gap-[10px] border-b border-black/6 dark:border-white/7 last:border-b-0"
					>
						<span className="text-gray-400 dark:text-slate-500 min-w-[20px] text-right text-[11px] shrink-0">
							{history.length - i}.
						</span>
						<span>{h}</span>
					</div>
				))}
			</div>
		</div>
	)
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function SnookerApp() {
	const [theme, setTheme] = useState("dark")

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark")

		const themeColorMeta = document.querySelector(
			'meta[name="theme-color"]',
		)
		if (themeColorMeta) {
			themeColorMeta.setAttribute(
				"content",
				theme === "dark" ? "#0e1520" : "#f1f5f9",
			)
		}
	}, [theme])

	const [p1Name, setP1Name] = useState("Joueur 1")
	const [p2Name, setP2Name] = useState("Joueur 2")
	const [setup, setSetup] = useState(true)
	const [game, setGame] = useState(null)
	const [stateHistory, setStateHistory] = useState([])

	const startGame = () => {
		setGame(
			makeInitialState(
				p1Name.trim() || "Joueur 1",
				p2Name.trim() || "Joueur 2",
			),
		)
		setStateHistory([])
		setSetup(false)
	}

	const dispatch = useCallback(
		(action, logMsg) => {
			setStateHistory((prev) => [...prev, game])
			const next = applyShot(game, action)
			if (logMsg) next.history = [...(game.history || []), logMsg]
			setGame(next)
		},
		[game],
	)

	const undo = () => {
		if (!stateHistory.length) return
		setGame(stateHistory[stateHistory.length - 1])
		setStateHistory((h) => h.slice(0, -1))
	}

	const resetGame = () => {
		setSetup(true)
		setGame(null)
		setStateHistory([])
	}

	const ThemeToggle = () => (
		<button
			onClick={() => setTheme((th) => (th === "dark" ? "light" : "dark"))}
			className="bg-white dark:bg-slate-900 border border-black/7 dark:border-white/8 rounded-[10px] px-[13px] py-[7px] text-gray-500 dark:text-slate-400 text-[13px] font-semibold cursor-pointer flex items-center gap-[6px] font-[inherit]"
		>
			{theme === "dark" ? "Light" : "Dark"}
		</button>
	)

	// ── Setup screen ──────────────────────────────────────────────────────
	if (setup) {
		return (
			<div className="min-h-screen bg-slate-100 dark:bg-[#0e1520] flex items-center justify-center p-6">
				<div className="w-full max-w-[385px] animate-fade-up">
					<div className="flex justify-end mb-6">
						<ThemeToggle />
					</div>

					<div className="text-center mb-11">
						<div className="text-[72px] leading-none mb-2"></div>
						<h1 className="m-0 text-[42px] font-black text-gray-900 dark:text-slate-100 tracking-[-2px] leading-none">
							Snooker
						</h1>
						<p className="mt-2 text-[11px] font-extrabold tracking-[0.3em] uppercase text-blue-600 dark:text-blue-500">
							Score Manager
						</p>
					</div>

					<div className="flex flex-col gap-[14px]">
						{[
							{ val: p1Name, set: setP1Name, num: "01" },
							{ val: p2Name, set: setP2Name, num: "02" },
						].map(({ val, set, num }, i) => (
							<div key={num}>
								<div className="text-[10px] font-extrabold tracking-[0.15em] uppercase text-gray-400 dark:text-slate-500 mb-[7px]">
									Joueur {num}
								</div>
								<input
									value={val}
									onChange={(e) => set(e.target.value)}
									onKeyDown={(e) =>
										e.key === "Enter" && startGame()
									}
									placeholder={`Nom du joueur ${i + 1}`}
									className="w-full px-4 py-[14px] rounded-[13px] text-[15px] font-semibold bg-black/4 dark:bg-white/6 border border-black/10 dark:border-white/12 text-gray-900 dark:text-slate-100 outline-none font-[inherit]"
								/>
							</div>
						))}
						<button
							onClick={startGame}
							className="mt-2 py-[15px] rounded-[14px] text-[15px] font-extrabold bg-linear-to-br from-blue-600 to-blue-700 text-white border-0 cursor-pointer tracking-[0.04em] font-[inherit] shadow-[0_8px_28px_rgba(37,99,235,0.4)] transition-[transform,box-shadow] duration-120 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(37,99,235,0.4)]"
						>
							Commencer la frame
						</button>
					</div>
				</div>
			</div>
		)
	}

	// ── Game screen ───────────────────────────────────────────────────────
	const g = game
	const cur = g.currentPlayer
	const opp = 1 - cur
	const nextColor =
		g.phase === "endgame" && g.colorsOnTable.length > 0
			? g.colorsOnTable[0]
			: null
	const canPotRed =
		!g.frameOver &&
		!g.missMode &&
		!g.missTargetMode &&
		g.phase === "red" &&
		g.redsLeft > 0
	const canPotColor =
		!g.frameOver &&
		!g.missMode &&
		!g.missTargetMode &&
		(g.phase === "color" || g.phase === "endgame")
	const canMiss = !g.frameOver && !g.missMode && !g.missTargetMode

	const phaseInfo =
		g.phase === "red"
			? {
					label: "Jouez une rouge",
					dot: "bg-[#e02020] shadow-[0_0_6px_rgba(220,32,32,0.4)]",
				}
			: g.phase === "color"
				? {
						label: "Jouez une couleur",
						dot: "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.4)]",
					}
				: g.phase === "endgame"
					? {
							label: `Phase finale · ${nextColor?.label || "Fin"}`,
							dot: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]",
						}
					: null

	return (
		<div className="min-h-screen bg-slate-100 dark:bg-[#0e1520] px-4 pt-4 pb-11 text-gray-900 dark:text-slate-100">
			<div className="max-w-[440px] mx-auto">
				{/* ── Top bar ── */}
				<div className="flex items-center justify-between mb-5">
					<div>
						<h1 className="m-0 text-[22px] font-black tracking-[-0.5px]">
							Snooker
						</h1>
						<div className="text-[11px] text-gray-400 dark:text-slate-500 mt-[3px] font-semibold">
							{g.redsLeft > 0
								? `${g.redsLeft} rouge${g.redsLeft > 1 ? "s" : ""} restante${g.redsLeft > 1 ? "s" : ""}`
								: "Phase finale"}
							<span className="mx-[5px] opacity-40">·</span>
							<span className="text-blue-600 dark:text-blue-500">
								{calcMaxRemaining(g.redsLeft, g.colorsOnTable)}{" "}
								pts
							</span>
						</div>
					</div>
					<div className="flex gap-2">
						<ThemeToggle />
						<button
							onClick={undo}
							disabled={!stateHistory.length}
							title="Annuler"
							className={[
								"bg-white dark:bg-slate-900 border border-black/7 dark:border-white/8 rounded-[10px] px-3 py-[7px] text-[14px] font-bold font-[inherit]",
								stateHistory.length
									? "text-amber-600 dark:text-amber-400 cursor-pointer"
									: "text-gray-400 dark:text-slate-600 cursor-not-allowed opacity-[0.38]",
							].join(" ")}
						>
							↩
						</button>
						<button
							onClick={resetGame}
							title="Réinitialiser"
							className="bg-white dark:bg-slate-900 border border-black/7 dark:border-white/8 rounded-[10px] px-3 py-[7px] text-red-600 dark:text-red-400 text-[14px] font-bold cursor-pointer font-[inherit]"
						>
							↺
						</button>
					</div>
				</div>

				{/* ── Score cards ── */}
				<div className="flex gap-3 mb-[14px]">
					{g.players.map((p, i) => {
						const isActive = i === g.currentPlayer && !g.frameOver
						return (
							<div
								key={i}
								className={[
									"flex-1 rounded-[20px] p-[18px_14px] text-center transition-all duration-300",
									isActive
										? "bg-linear-to-br from-blue-100 to-blue-50 dark:from-[#1a2e50] dark:to-[#0f1e38] border-2 border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.22)]"
										: "bg-white dark:bg-slate-900 border-2 border-black/7 dark:border-white/8",
								].join(" ")}
							>
								<div className="text-[10px] font-extrabold tracking-[0.13em] uppercase text-gray-400 dark:text-slate-500 mb-[7px]">
									{p.name}
								</div>
								<div className="text-[54px] font-black leading-none tracking-[-2px]">
									{p.score}
								</div>
								{isActive && (
									<div className="mt-2 flex items-center justify-center gap-[5px]">
										<span className="w-[6px] h-[6px] rounded-full bg-blue-500 inline-block animate-pulse" />
										<span className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold tracking-widest">
											EN JEU
										</span>
									</div>
								)}
							</div>
						)
					})}
				</div>

				{/* ── Phase indicator ── */}
				{phaseInfo &&
					!g.frameOver &&
					!g.missMode &&
					!g.missTargetMode && (
						<div className="text-center mb-3">
							<span className="inline-flex items-center gap-[7px] px-[18px] py-[6px] rounded-full bg-white dark:bg-slate-900 border border-black/7 dark:border-white/8 text-[12px] font-bold text-gray-500 dark:text-slate-400">
								<span
									className={`w-[7px] h-[7px] rounded-full inline-block animate-pulse ${phaseInfo.dot}`}
								/>
								{phaseInfo.label}
								<span className="opacity-45 text-[11px]">
									— {g.players[cur].name}
								</span>
							</span>
						</div>
					)}

				{/* ── Message ── */}
				{g.message && !g.frameOver && (
					<div className="bg-blue-500/9 border border-blue-500/22 rounded-xl px-4 py-[10px] mb-[14px] text-[13px] text-blue-600 dark:text-blue-300 font-semibold text-center">
						{g.message}
					</div>
				)}

				{/* ── Frame over ── */}
				{g.frameOver && (
					<div className="bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-[22px] p-[32px_24px] text-center mb-4 shadow-[0_0_0_6px_rgba(59,130,246,0.22)] animate-fade-up">
						<div className="text-[52px] mb-[10px]">🏆</div>
						<div className="text-[24px] font-black mb-[6px] tracking-[-0.5px]">
							{g.winner !== null
								? `${g.players[g.winner].name} remporte la frame !`
								: "Égalité !"}
						</div>
						<div className="text-[15px] text-gray-400 dark:text-slate-500 mb-6">
							{g.players[0].name}{" "}
							<strong className="text-gray-900 dark:text-slate-100 text-[18px]">
								{g.players[0].score}
							</strong>
							<span className="mx-[10px] opacity-40">—</span>
							<strong className="text-gray-900 dark:text-slate-100 text-[18px]">
								{g.players[1].score}
							</strong>{" "}
							{g.players[1].name}
						</div>
						<button
							onClick={resetGame}
							className="px-7 py-3 rounded-[13px] bg-linear-to-br from-blue-600 to-blue-700 text-white border-0 font-extrabold text-[14px] cursor-pointer shadow-[0_6px_20px_rgba(37,99,235,0.4)] font-[inherit]"
						>
							Nouvelle frame
						</button>
					</div>
				)}

				{/* ── Miss: type de faute ── */}
				{g.missTargetMode && !g.frameOver && (
					<Card
						borderClass="border-2 border-orange-500/30"
						className="mb-[14px] animate-fade-up-fast"
					>
						<div className="text-center mb-4">
							<div className="text-[13px] font-extrabold text-amber-600 dark:text-amber-400 mb-1">
								Miss — type de faute
							</div>
							<div className="text-[12px] text-gray-400 dark:text-slate-500">
								Comment{" "}
								<strong className="text-gray-900 dark:text-slate-100">
									{g.players[cur].name}
								</strong>{" "}
								a-t-il manqué ?
							</div>
						</div>

						{/* Cas 1 : rien touché */}
						<button
							onClick={() =>
								dispatch(
									{
										type: "miss_set_target",
										contact: "nothing",
										ballPoints: 0,
										ballLabel: "rien",
										ballId: "nothing",
									},
									`Miss (sans contact) — ${g.players[opp].name} +4pts`,
								)
							}
							className="w-full px-[14px] py-[11px] rounded-xl mb-2 bg-slate-50 dark:bg-slate-800 border border-black/7 dark:border-white/8 text-gray-900 dark:text-slate-100 text-[13px] font-bold cursor-pointer font-[inherit] text-left flex justify-between items-center hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
						>
							<span>🚫 Sans contact</span>
							<span className="text-[12px] text-gray-400 dark:text-slate-500 font-semibold">
								4 pts
							</span>
						</button>

						{/* Cas 3 : mauvaise couleur touchée */}
						<div className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-[0.1em] mt-[10px] mb-2">
							Mauvaise couleur touchée
						</div>
						<div className="flex flex-wrap gap-2">
							{[
								{
									id: "red",
									label: "Rouge",
									points: 1,
									ball: "#d42020",
									text: "#fff",
								},
								...COLORS,
							].map((ball) => {
								const awarded = Math.max(FOUL_MIN, ball.points)
								return (
									<button
										key={ball.id}
										onClick={() =>
											dispatch(
												{
													type: "miss_set_target",
													contact: "wrong_color",
													ballPoints: ball.points,
													ballLabel: ball.label,
													ballId: ball.id,
												},
												`Miss (${ball.label} touchée) — ${g.players[opp].name} +${awarded}pts`,
											)
										}
										className="flex items-center gap-[7px] px-3 py-[7px] rounded-[9px] bg-slate-50 dark:bg-slate-800 border border-black/7 dark:border-white/8 text-gray-900 dark:text-slate-100 text-[12px] font-bold cursor-pointer font-[inherit] transition-transform duration-100 hover:-translate-y-px"
									>
										<span
											className="w-[14px] h-[14px] rounded-full shrink-0"
											style={{ background: ball.ball }}
										/>
										{ball.label}
										<span className="text-gray-400 dark:text-slate-500 font-semibold">
											· {awarded}
										</span>
									</button>
								)
							})}
						</div>
						{/* Cas 2 : mauvaise rouge rentrée */}
						<div className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-[0.1em] mt-[10px] mb-2">
							Mauvaise rouge rentrée
						</div>
						{g.redsLeft > 0 && (
							<button
								onClick={() =>
									dispatch(
										{
											type: "miss_set_target",
											contact: "wrong_red",
											ballPoints: 1,
											ballLabel: "rouge",
											ballId: "red",
										},
										`Miss (rouge rentrée) — ${g.players[opp].name} +4pts`,
									)
								}
								className="w-full px-[14px] py-[11px] rounded-xl bg-red-500/7 border border-red-500/25 text-gray-900 dark:text-slate-100 text-[13px] font-bold cursor-pointer font-[inherit] text-left flex justify-between items-center hover:bg-red-500/13 transition-colors"
							>
								<div className="flex items-center gap-[8px]">
									<span
										className="w-[14px] h-[14px] rounded-full shrink-0"
										style={{ background: "#d42020" }}
									/>
									<span>
										Rouge{" "}
										<span className="text-[11px] font-medium opacity-65">
											(rentrée — retire 1 rouge)
										</span>
									</span>
								</div>
								<span className="text-[12px] text-red-500 font-bold">
									4 pts
								</span>
							</button>
						)}
					</Card>
				)}

				{/* ── Miss: opponent decision ── */}
				{g.missMode && !g.frameOver && (
					<Card
						borderClass="border-2 border-orange-500/30"
						className="mb-[14px] animate-fade-up-fast"
					>
						<div className="text-center mb-4">
							<div className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-amber-600 dark:text-amber-400 mb-[6px]">
								Faute de miss
							</div>
							<div className="text-[36px] font-black leading-none">
								{g.missFoulValue}
							</div>
							<div className="text-[12px] text-gray-400 dark:text-slate-500 mt-1">
								pts attribués à{" "}
								<strong className="text-gray-900 dark:text-slate-100">
									{g.players[opp].name}
								</strong>
							</div>
						</div>
						<div className="text-[12px] text-gray-400 dark:text-slate-500 text-center mb-3 font-semibold">
							{g.players[opp].name}, que décidez-vous ?
						</div>
						<div className="flex gap-[10px]">
							<Btn
								onClick={() =>
									dispatch(
										{ type: "miss_replay" },
										`${g.players[cur].name} rejoue (${g.missFoulValue}pts à ${g.players[opp].name})`,
									)
								}
								variant="warn"
								className="flex-1"
							>
								Faire rejouer
							</Btn>
							<Btn
								onClick={() =>
									dispatch(
										{ type: "miss_accept" },
										`${g.players[opp].name} joue (${g.missFoulValue}pts reçus)`,
									)
								}
								variant="success"
								className="flex-1"
							>
								Je joue
							</Btn>
						</div>
					</Card>
				)}

				{/* ── Main panel ── */}
				{!g.frameOver && !g.missMode && !g.missTargetMode && (
					<div className="flex flex-col gap-3">
						{/* Red phase */}
						{g.phase === "red" && (
							<Card>
								<SectionLabel>Empochée</SectionLabel>
								<div className="flex justify-center">
									<div className="flex flex-col items-center gap-2">
										<RedBall3D
											onClick={() =>
												dispatch(
													{ type: "pot_red" },
													`Rouge — ${g.players[cur].name}`,
												)
											}
											disabled={!canPotRed}
											size={76}
										/>
										<span className="text-[11px] text-gray-400 dark:text-slate-500 font-semibold">
											Rouge · 1 pt
										</span>
									</div>
								</div>
							</Card>
						)}

						{/* Color / endgame phase */}
						{(g.phase === "color" || g.phase === "endgame") && (
							<Card>
								<SectionLabel>Couleur empochée</SectionLabel>

								{g.phase === "color" && (
									<div
										className={[
											"flex items-center justify-between gap-[10px] mb-4 px-[14px] py-[10px] rounded-xl border transition-all duration-220",
											g.extraReds > 0
												? "bg-red-500/10 border-red-500/35"
												: "bg-slate-50 dark:bg-slate-800 border-black/7 dark:border-white/8",
										].join(" ")}
									>
										<div className="flex flex-col gap-0.5">
											<span
												className={`text-[11px] font-extrabold tracking-[0.08em] uppercase ${g.extraReds > 0 ? "text-[#e02020]" : "text-gray-400 dark:text-slate-500"}`}
											>
												Rouges empochées
											</span>
											<span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
												{g.extraReds > 0
													? `Doublé(s) : ${g.extraReds + 1} rouges au total`
													: "Une seule rouge ? Ou doublé ?"}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<div className="flex gap-1 items-center">
												{Array.from({
													length: 1 + g.extraReds,
												}).map((_, i) => (
													<div
														key={i}
														className="w-[18px] h-[18px] rounded-full bg-[#d42020] shadow-[0_1px_4px_rgba(0,0,0,0.25)]"
													/>
												))}
											</div>
											<button
												onClick={() =>
													dispatch(
														{
															type: "add_extra_red",
														},
														`Rouge bonus (${g.players[cur].name})`,
													)
												}
												disabled={g.redsLeft <= 1}
												title="Une rouge supplémentaire est tombée en même temps"
												className={[
													"w-[34px] h-[34px] rounded-full border-0 text-[22px] font-black leading-none text-white shrink-0 flex items-center justify-center transition-transform duration-120 font-[inherit]",
													g.redsLeft > 1
														? "bg-[#d42020] cursor-pointer shadow-[0_1px_6px_rgba(0,0,0,0.25)] hover:scale-[1.15]"
														: "bg-gray-400 cursor-not-allowed opacity-[0.32]",
												].join(" ")}
											>
												+
											</button>
										</div>
									</div>
								)}

								<div className="flex flex-wrap justify-center gap-[14px]">
									{(g.phase === "endgame"
										? [g.colorsOnTable[0]].filter(Boolean)
										: COLORS
									).map((ball) => (
										<div
											key={ball.id}
											className="flex flex-col items-center gap-[6px]"
										>
											<Ball3D
												ball={ball}
												size={60}
												disabled={!canPotColor}
												onClick={() =>
													dispatch(
														{
															type: "pot_color",
															ball,
														},
														g.extraReds > 0
															? `🔴×${g.extraReds + 1} + ${ball.label} (${ball.points}pts) — ${g.players[cur].name}`
															: `${ball.label} (${ball.points}pts) — ${g.players[cur].name}`,
													)
												}
											/>
											<span className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold">
												{ball.label}
											</span>
										</div>
									))}
								</div>
							</Card>
						)}

						{/* End break + Miss */}
						<div className="grid grid-cols-2 gap-[10px]">
							<Btn
								onClick={() =>
									dispatch(
										{ type: "end_break" },
										`➡ ${g.players[cur].name} passe la main`,
									)
								}
								variant="default"
							>
								Fin de break
							</Btn>
							<Btn
								onClick={() => dispatch({ type: "miss" }, null)}
								disabled={!canMiss}
								variant="warn"
							>
								Miss (faute)
							</Btn>
						</div>

						{/* Fouls */}
						<Card>
							<SectionLabel>Faute sur bille</SectionLabel>
							<div className="flex flex-wrap justify-center gap-[7px]">
								{/* Faute générique */}
								<button
									onClick={() =>
										dispatch(
											{ type: "foul", value: 0 },
											`⚠ Faute — ${g.players[opp].name} +4pts`,
										)
									}
									className="px-[13px] py-[7px] rounded-[9px] bg-black/4 dark:bg-white/5 border border-black/9 dark:border-white/11 text-gray-600 dark:text-slate-300 text-[12px] font-bold cursor-pointer font-[inherit] transition-transform duration-100 hover:-translate-y-px"
								>
									Faute · 4
								</button>
								{/* Fautes sur couleurs */}
								{COLORS.map((ball) => (
									<button
										key={ball.id}
										onClick={() =>
											dispatch(
												{
													type: "foul",
													value: ball.points,
												},
												`⚠ Faute ${ball.label} — ${g.players[opp].name} +${Math.max(4, ball.points)}pts`,
											)
										}
										className="px-[13px] py-[7px] rounded-[9px] bg-black/4 dark:bg-white/5 border border-black/9 dark:border-white/11 text-gray-600 dark:text-slate-300 text-[12px] font-bold cursor-pointer font-[inherit] transition-transform duration-100 hover:-translate-y-px"
									>
										{ball.label} ·{" "}
										{Math.max(4, ball.points)}
									</button>
								))}
								{/* Faute rouge rentrée — retire une rouge */}
								<button
									onClick={() =>
										dispatch(
											{ type: "foul_red" },
											`⚠ Faute rouge rentrée — ${g.players[opp].name} +4pts`,
										)
									}
									disabled={g.redsLeft === 0}
									className={[
										"px-[13px] py-[7px] rounded-[9px] bg-red-500/9 border border-red-500/30 text-red-500 text-[12px] font-bold font-[inherit] transition-transform duration-100",
										g.redsLeft === 0
											? "opacity-30 cursor-not-allowed"
											: "cursor-pointer hover:-translate-y-px",
									].join(" ")}
								>
									Rouge · 4
								</button>
							</div>
						</Card>
					</div>
				)}

				<HistoryLog history={g.history} />
			</div>
		</div>
	)
}
