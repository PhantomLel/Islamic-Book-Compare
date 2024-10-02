import { useRouter } from "expo-router";
import { Image, Pressable, View, } from "react-native";
import { Text } from "react-native-paper";
import { useTheme, Paragraph } from "react-native-paper";

export type Book = {
    title: string;
    source: string;
    price: number;
    image: string;
    url: string;
    author: string | undefined;
    publisher: string | undefined;
};


export default function BookCard(props: { book: any }) {
    const { book } = props;
    const theme = useTheme();
    const router = useRouter();

    return (
        <Pressable 
        style={{
            flex: 1,
            width: "50%",
            padding: 10,
        }}
        onPressOut={() => {
            router.navigate({ 
                pathname: "/book/[url]",
                params: { url: JSON.stringify(book)},
                
            });
        }}>
        <View style={{
            backgroundColor: theme.colors.elevation.level5,
            margin: 10,
            padding: 10,
            paddingTop: 0,
            borderColor: theme.colors.primary,
            borderRadius: 10,
            height: 400,
        }}>
            <Image
                style={{
                    alignSelf: "center",
                    width: 150,
                    height: 225,
                    resizeMode: "contain",
                    borderRadius: 5,
                }}
                source={{ uri: book.image }} />
            <Text
                adjustsFontSizeToFit={true}
                style={{
                    fontWeight: "bold",
                    textAlign: "center",
                    marginTop: 5,
                }}
            >
                {book.title.substring(0, 50) + (book.title.length > 50 ? "..." : "")}
            </Text>
            <Text style={{ marginTop: 5 }}>{book.author}</Text>
            <Text style={{ fontWeight: "bold" }}>${book.price.toFixed(2)}</Text>
            <Text>{book.source}</Text>
            <View
                style={{
                    borderColor: book.instock ? "#009933" : theme.colors.error,
                    borderWidth: 2,
                    padding: 5,
                    borderRadius: 5,
                    marginTop: "auto",
                    alignSelf: "flex-start"
                }}
            >
                <Text variant="bodySmall" style={{
                    color: book.instock ? "#009933" : theme.colors.error,
                    fontWeight: "bold",
                }}>{book.instock ? "In Stock" : "Out of Stock"}</Text>
            </View>
        </View>
    </Pressable>
    );
}