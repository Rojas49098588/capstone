import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#2d3a8c", headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Pets" }} />
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
