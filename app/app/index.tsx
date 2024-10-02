import React, { useEffect, useState } from "react";
import { Appearance, FlatList, View, ScrollView } from "react-native";
import { TextInput, useTheme, Text, Surface } from "react-native-paper";
import BookCard, { Book } from "@/components/BookCard";

export default function Index() {

  const theme = useTheme();
  Appearance.setColorScheme("dark");

  const searchURL = "http://localhost:8000/search"
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("b");
  const [books, setBooks] = useState<Book[]>([]);
  const [page, setPage] = useState(1);
  const [isEnd, setIsEnd] = useState(false);

  const listView: React.RefObject<FlatList> = React.createRef();


  const updateSearch = (text: string) => {

    if (text === "") {
      setBooks([]);
      setTotal(0);
      return
    }

    setSearch(text);
    let query = new URLSearchParams();
    query.set("search", search);
    query.set("page", "1");
    query.set("show", "16");

    setIsEnd(false);
    setPage(1);


    listView.current?.scrollToOffset({ animated: true, offset: 0 });

    fetch(searchURL + "?" + query.toString())
      .then((response) => response.json())
      .then((data) => {
        if (data.length === 0) {
          return;
        }
        setBooks(data.results);
        setTotal(data.total);
      });
  }

  const updateScroll = (newPage: number) => {
    if (isEnd) {
      return;
    }
    let query = new URLSearchParams();
    query.set("search", search);
    query.set("page", newPage.toString());
    query.set("show", "32");

    fetch(searchURL + "?" + query.toString())
      .then((response) => response.json())
      .then((data) => {
        if (data.results.length === 0) {
          setIsEnd(true);
          return;
        }
        setBooks(books.concat(data.results));
        setPage(newPage);
        setTotal(data.total);
      });
  }

  useEffect(() => {
    updateSearch(search);
  }, []);
  return (
    <View
      style={{
        backgroundColor: theme.colors.background,
        height: "100%",
      }}
    >

      <Surface elevation={4} style={{
        marginTop: 55,
        margin: 20,
        padding: 10,
      }}>
        <TextInput
          onChangeText={(text) => {
            updateSearch(text);
          }}
          autoCorrect={false}
          label="Search"
          mode="outlined"
        />
      </Surface>
      <View style={{
        alignItems: "center",
      }}>
        <Text style={{
          color: theme.colors.primary,
          fontSize: 20,
          marginTop: 5,
          marginBottom: 40,
        }}>
          <Text style={{ fontWeight: "bold" }}>{total} </Text>
          results for search "{search}"</Text>
      </View>
      <FlatList
        ref={listView}
        onEndReachedThreshold={0.2}
        onEndReached={() => {
          updateScroll(page + 1);
        }}
        columnWrapperStyle={{
          justifyContent: "center",
        }}
        data={books}
        numColumns={2}
        renderItem={({ item }) => <BookCard book={item} />}
        ListFooterComponent={
          <Text

            variant="titleLarge" style={{
              textAlign: "center",
              marginBottom: 30,
              display: isEnd ? "flex" : "none",
            }}>End of results</Text>
        }
      />
    </View>
  );
}
