import React from "react";
import { View, Image } from "react-native";
import { Book } from "@/components/BookCard";
import {Button, Divider, Text, useTheme } from "react-native-paper"
import { useLocalSearchParams, useRouter } from "expo-router";

export default function BookView() {
    // get the params passed to this component
    const theme = useTheme();
    const router = useRouter();
    const { url } = useLocalSearchParams();
    const data: Book = JSON.parse(url.toString());

    return (
        <View
        style={{
            backgroundColor: theme.colors.background,
            height: "100%",
        }}
        >
            <Image
                source={{ uri: data.image }}
                style={{
                    
                    margin: 20,
                    marginTop: 70,
                    height: "50%",
                    resizeMode: "contain",
                }}
            />
            <View
                style={{
                    flex: 1,
                    alignItems: "center",
                }}
            >
                <Text
                    style={{
                        fontWeight: "bold",
                    }}
                    variant="titleLarge"
                >{data.title}</Text>
                <Divider
                style={{
                    margin: 10,
                    width: "75%",
                    backgroundColor: theme.colors.primary,
                }}
                />
                <Text
                    variant="titleMedium"
                    style={{
                        marginTop: 10,
                    }}
                >
                    {data.author} 
                </Text>    
            </View>
            <Button
            onPress={() => {
                router.back();
            }}
            style={{ 
                margin: 20,
                marginBottom: 50,
                marginTop: "auto",
                width: 150,
                display: "flex"

            }}
            mode="contained"
            icon="chevron-left">
                <Text
                style={{
                    color: theme.colors.background,
                    fontSize: 20,
                    fontWeight: "bold",
                }}
                >
                    Back
                </Text>
            </Button>
        </View>
    );
}