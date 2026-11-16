import { needsYou, petGroups, type PetCard } from "@shared/companion/view";
import { MOOD_COLORS } from "@shared/ui/format";
import { useState } from "react";
import { Image, RefreshControl, ScrollView, Text, View } from "react-native";
import { usePhone } from "./PhoneContext";
import { PET_ART } from "./petArt";
import { colors, ui } from "./theme";

export const NO_PETS_LINE = "No pets yet. Create a project in Studium on your computer.";

function Card({ pet }: { pet: PetCard }) {
  return (
    <View style={[ui.card, { flexDirection: "row", gap: 10, alignItems: "center" }]} accessible accessibilityLabel={`${pet.name}${pet.mood ? `, ${pet.mood}` : ""}`}>
      <Image source={PET_ART[pet.kind]} style={{ width: 44, height: 44 }} resizeMode="contain" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={ui.bold}>{pet.name}</Text>
        <Text style={ui.small}>{pet.looksAfter}</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {pet.mood ? (
            <Text style={[ui.small, { color: "#fff", backgroundColor: MOOD_COLORS[pet.mood], paddingHorizontal: 7, borderRadius: 8, overflow: "hidden" }]}>{pet.mood}</Text>
          ) : null}
          {pet.recovering ? <Text style={[ui.small, { backgroundColor: colors.mutedBg, paddingHorizontal: 7, borderRadius: 8, overflow: "hidden" }]}>Recovering</Text> : null}
        </View>
        {pet.food ? <Text style={[ui.small, { color: colors.primary }]}>{pet.food}</Text> : null}
      </View>
    </View>
  );
}

export default function PetsScreen() {
  const { phone, state } = usePhone();
  const [refreshing, setRefreshing] = useState(false);
  const groups = petGroups(state.data, state.now);
  const needs = needsYou(state.data, state.now);

  async function refresh() {
    setRefreshing(true);
    await phone.reconnect();
    setRefreshing(false);
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Text style={ui.title}>Your pets</Text>
      {state.message ? <Text style={[ui.banner, ui.small]}>{state.message}</Text> : null}
      {needs.length > 0 ? (
        <View style={[ui.card, { backgroundColor: colors.needsBg, borderColor: colors.needsBorder, gap: 4 }]} accessibilityLabel="Needs you on the desktop">
          <Text style={[ui.section, { color: colors.accent, marginTop: 0 }]}>Needs you on the desktop</Text>
          {needs.map((n) => (
            <Text key={`${n.kind}-${n.petId}`} style={ui.text}>
              {n.text}
            </Text>
          ))}
        </View>
      ) : null}
      {groups.length === 0 ? <Text style={ui.text}>{NO_PETS_LINE}</Text> : null}
      {groups.map((g) => (
        <View key={g.projectId} style={{ gap: 6 }}>
          <Text style={ui.section}>{g.heading}</Text>
          {g.pets.map((p) => (
            <Card key={p.petId} pet={p} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
