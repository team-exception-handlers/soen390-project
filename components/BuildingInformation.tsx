import { ChevronDown } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
type BuildingInformationProps = {
    buildingCode: string | null;
    onClose: () => void;
    buildingName: string | undefined;
    buildingInfo: string | undefined;
    buildingPhotoLink: string | undefined;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;
const EXPANDED_HEIGHT =Math.min(600, SCREEN_HEIGHT * 0.9);
const COLLAPSED_HEIGHT = 0;

export default function BuildingInformation({buildingCode, onClose, buildingName, buildingInfo, buildingPhotoLink, }: BuildingInformationProps) {
    const heightAnimation = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
    const animateTo = (toValue: number) => {
        Animated.timing(heightAnimation, {
            toValue,
            duration: 220,
            useNativeDriver: false,
        }).start();
    };

    useEffect(() => {
        if(!buildingCode) {
            animateTo(COLLAPSED_HEIGHT);
            return;
        }

        animateTo(EXPANDED_HEIGHT);
    }, [buildingCode]);

    return (
        <View style = {styles.overlay} pointerEvents = "box-none">
            <Animated.View style={[styles.drawer, {height: heightAnimation}]}>
                <View style={styles.handleRow}>
                    <Pressable onPress={onClose} style={styles.closeBtn}>
                        <ChevronDown size={24} color="#8e8e93"/>
                    </Pressable>
                    <View style={styles.header}>
                        <Text style={styles.title}>{buildingName}</Text>
                    </View>
                </View>

                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    {buildingPhotoLink ? (<Image style={styles.image} source={{ uri:buildingPhotoLink }} resizeMode="contain" />) : null }
                    <Text style={styles.bodyText}>
                        {buildingInfo ? buildingInfo : "Building information not available."}
                    </Text>
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: 9999,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    drawer: {
        width: "100%",
        maxWidth: 520,
        alignSelf: "center",
        backgroundColor: "#FFFFFF",
        borderRadius:16,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: {width: 0, height: 4},
        elevation: 10,
    },

    handleRow: {
        paddingTop: 10,
        paddingHorizontal: 14,
        paddingBottom: 10,
        borderBottomWidth: 10,
        borderBottomColor: "#e5e5ea",
    },
    header:{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    title: { 
        fontSize: 18,
        fontWeight: "700",
    },
    closeBtn: {
        alignSelf: "center",
        padding: 4,
        marginBottom: 5,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 14, 
        paddingBottom: 22,
    },
    bodyText: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 50,
    },
    image: {
        width: "100%",
        height: 250,
        marginBottom: 14,
    },
});