import { PaperProvider } from "react-native-paper";
import { Slot } from "expo-router";

export default function RootLayout() {
  return (
    <PaperProvider>
        <Slot/>
    </PaperProvider>
  );
}
