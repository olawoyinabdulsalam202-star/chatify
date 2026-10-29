import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default class RowErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <View style={styles.fallback}><Text style={styles.text}>Chat unavailable</Text></View>;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({ fallback: { minHeight: 76, justifyContent: "center", paddingHorizontal: 18 }, text: { color: "#A59889", fontSize: 14 } });
