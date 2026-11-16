import { pendingRows, todayRows, type TodayRow } from "@shared/companion/view";
import { localDateKey, startOfLocalDay } from "@shared/planner/time";
import { ESTIMATE_CHOICES, formatMinutes, payoutMessage } from "@shared/ui/format";
import { useEffect, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { usePhone } from "./PhoneContext";
import { NO_PETS_LINE } from "./PetsScreen";
import { colors, ui } from "./theme";

function Row({ row, onTick }: { row: TodayRow; onTick: (row: TodayRow) => void }) {
  const details = [row.projectName, formatMinutes(row.estimateMin), row.due ? `due ${row.due}` : null].filter(Boolean).join(" · ");
  return (
    <View style={[ui.card, { flexDirection: "row", gap: 10, alignItems: "flex-start" }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: row.done, disabled: row.blocked }}
        accessibilityLabel={row.done ? `Reopen ${row.title}` : `Complete ${row.title}`}
        disabled={row.blocked}
        onPress={() => onTick(row)}
        hitSlop={10}
        style={{ width: 20, height: 20, marginTop: 2, borderRadius: 5, borderWidth: 1.5, borderColor: row.done ? colors.primary : colors.muted, backgroundColor: row.done ? colors.primary : "transparent", opacity: row.blocked ? 0.4 : 1 }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[ui.text, row.done && { textDecorationLine: "line-through", color: colors.muted }]}>{row.title}</Text>
        <Text style={ui.small}>
          <Text style={{ color: row.color }}>● </Text>
          {details}
        </Text>
        {row.pending ? <Text style={[ui.small, { alignSelf: "flex-start", borderColor: colors.border, borderWidth: 1, paddingHorizontal: 5 }]}>Pending</Text> : null}
        {row.blocked ? <Text style={ui.small}>Waiting on another task</Text> : null}
      </View>
    </View>
  );
}

function CompletionSheet({ row, onClose }: { row: TodayRow | null; onClose: (note: string | null) => void }) {
  const { phone, state } = usePhone();
  const [minutes, setMinutes] = useState(row?.estimateMin ?? 0);
  useEffect(() => setMinutes(row?.estimateMin ?? 0), [row]);
  if (!row) return null;
  const choices = [...new Set([row.estimateMin, ...ESTIMATE_CHOICES])].filter((m) => m > 0).sort((a, b) => a - b);

  function finish(actual: number | null) {
    const task = state.data.tasks.find((t) => t.id === row!.taskId);
    const payout = phone.complete(row!.taskId, actual);
    if (!payout || !task) return onClose(null);
    onClose(row!.pending ? "Done. It earns tokens once it has its details on the desktop." : payoutMessage(payout, task));
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={() => onClose(null)}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(26,24,22,0.4)" }}>
        <View style={[ui.card, { borderRadius: 18, padding: 18, gap: 12 }]}>
          <Text style={ui.bold}>How long did it take?</Text>
          <Text style={ui.small}>{row.title}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {choices.map((m) => (
              <Pressable
                key={m}
                accessibilityRole="radio"
                accessibilityState={{ selected: minutes === m }}
                accessibilityLabel={formatMinutes(m)}
                onPress={() => setMinutes(m)}
                style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: minutes === m ? colors.primary : colors.border, backgroundColor: minutes === m ? colors.primary : colors.card }}
              >
                <Text style={[ui.small, { color: minutes === m ? "#fff" : colors.foreground }]}>{formatMinutes(m)}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={ui.button} accessibilityRole="button" onPress={() => finish(minutes > 0 ? minutes : null)}>
            <Text style={ui.buttonText}>Done</Text>
          </Pressable>
          <Pressable style={ui.buttonSecondary} accessibilityRole="button" onPress={() => finish(null)}>
            <Text style={ui.bold}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function QuickAdd({ onAdded }: { onAdded: (note: string) => void }) {
  const { phone, state } = usePhone();
  const projects = state.data.projects;
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [toToday, setToToday] = useState(false);
  const [error, setError] = useState("");
  const chosen = projects.find((p) => p.id === projectId) ?? projects[0];

  if (projects.length === 0) {
    return (
      <View style={[ui.card, { opacity: 0.6 }]} accessibilityState={{ disabled: true }}>
        <Text style={ui.bold}>+ Quick add</Text>
        <Text style={ui.small}>{NO_PETS_LINE}</Text>
      </View>
    );
  }

  function add() {
    if (!title.trim()) {
      setError("Give the task a name.");
      return;
    }
    phone.quickAdd({ projectId: chosen.id, title, addToToday: toToday });
    setTitle("");
    setError("");
    onAdded(toToday ? "Added to today and Pending." : "Added to Pending.");
  }

  return (
    <View style={[ui.card, { gap: 8, borderStyle: "dashed", borderColor: colors.accent }]}>
      <Text style={[ui.bold, { color: colors.accent }]}>+ Quick add</Text>
      <TextInput style={ui.input} accessibilityLabel="Task name" placeholder="What needs doing?" value={title} onChangeText={setTitle} onSubmitEditing={add} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {projects.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: p.id === chosen.id }}
            accessibilityLabel={p.name}
            onPress={() => setProjectId(p.id)}
            style={{ paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: p.id === chosen.id ? p.color : colors.border, backgroundColor: p.id === chosen.id ? p.color : colors.card }}
          >
            <Text style={[ui.small, { color: p.id === chosen.id ? "#fff" : colors.foreground }]}>{p.shortName}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={ui.text}>Also add to today</Text>
        <Switch accessibilityLabel="Also add to today" value={toToday} onValueChange={setToToday} />
      </View>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Pressable style={ui.button} accessibilityRole="button" accessibilityLabel="Add" onPress={add}>
        <Text style={ui.buttonText}>Add</Text>
      </Pressable>
    </View>
  );
}

export default function TodayScreen() {
  const { phone, state } = usePhone();
  const [ticking, setTicking] = useState<TodayRow | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const rows = todayRows(state.data, state.now);
  const pending = pendingRows(state.data, state.now);
  const day = startOfLocalDay(localDateKey(state.now)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  function tick(row: TodayRow) {
    if (row.done) phone.reopen(row.taskId);
    else setTicking(row);
  }

  async function refresh() {
    setRefreshing(true);
    await phone.reconnect();
    setRefreshing(false);
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Text style={ui.title}>Today</Text>
      <Text style={ui.small}>{`${day} · your plan from the desktop`}</Text>
      {state.message ? <Text style={[ui.banner, ui.small]}>{state.message}</Text> : null}
      {note ? (
        <Text style={[ui.banner, ui.text]} accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : null}
      {rows.length === 0 ? <Text style={ui.text}>Nothing planned for today yet.</Text> : null}
      {rows.map((r) => (
        <Row key={r.taskId} row={r} onTick={tick} />
      ))}
      {pending.length > 0 ? <Text style={ui.section}>Pending: add details on the desktop</Text> : null}
      {pending.map((r) => (
        <Row key={r.taskId} row={r} onTick={tick} />
      ))}
      <QuickAdd onAdded={setNote} />
      <CompletionSheet
        row={ticking}
        onClose={(n) => {
          setTicking(null);
          if (n) setNote(n);
        }}
      />
    </ScrollView>
  );
}
