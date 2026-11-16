import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';

const { width } = Dimensions.get('window');

interface Props {
  onFinish: () => void;
}

export const AnimatedSplashScreen: React.FC<Props> = ({ onFinish }) => {
  const logoScale     = useRef(new Animated.Value(0.3)).current;
  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const pulse1        = useRef(new Animated.Value(0.7)).current;
  const pulse1Opacity = useRef(new Animated.Value(0.45)).current;
  const pulse2        = useRef(new Animated.Value(0.7)).current;
  const pulse2Opacity = useRef(new Animated.Value(0.25)).current;
  const titleY        = useRef(new Animated.Value(20)).current;
  const titleOpacity  = useRef(new Animated.Value(0)).current;

  // Teks A: "Sekolah Kita, Sekitar Kita"
  const textAOpacity  = useRef(new Animated.Value(0)).current;
  const textAY        = useRef(new Animated.Value(10)).current;

  // Teks B: "Sistem Kemudahan Informasi & Titik Akses Sekolah"
  const textBOpacity  = useRef(new Animated.Value(0)).current;
  const textBY        = useRef(new Animated.Value(10)).current;

  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Radar wave loop
    Animated.loop(
      Animated.parallel([
        Animated.timing(pulse1, { toValue: 1.8, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse1Opacity, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    ).start();

    const pulseTimer = setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(pulse2, { toValue: 1.8, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse2Opacity, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ])
      ).start();
    }, 800);

    // 2. Logo masuk
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 38, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    // 3. Teks "SKITA" muncul (S hijau, KITA biru)
    Animated.parallel([
      Animated.timing(titleY, { toValue: 0, duration: 400, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 400, delay: 250, useNativeDriver: true }),
    ]).start();

    // Helper transisi cross-fade
    const showA = () => {
      textAY.setValue(10);
      return Animated.parallel([
        Animated.timing(textAOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(textAY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]);
    };

    const hideA = () => {
      return Animated.parallel([
        Animated.timing(textAOpacity, { toValue: 0, duration: 240, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(textAY, { toValue: -8, duration: 240, useNativeDriver: true }),
      ]);
    };

    const showB = () => {
      textBY.setValue(10);
      return Animated.parallel([
        Animated.timing(textBOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(textBY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]);
    };

    const hideB = () => {
      return Animated.parallel([
        Animated.timing(textBOpacity, { toValue: 0, duration: 240, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(textBY, { toValue: -8, duration: 240, useNativeDriver: true }),
      ]);
    };

    // 4. Sequence teks berpindah 2 siklus penuh:
    // A muncul -> switch 1 -> B muncul -> switch 2 -> A muncul -> switch 3 -> B muncul -> selesai
    const sequence = Animated.sequence([
      Animated.delay(400),
      showA(),                  // A awal muncul
      Animated.delay(1000),     // waktu baca A
      hideA(),                  // Pindah 1: A -> B
      showB(),                  // B muncul
      Animated.delay(1000),     // waktu baca B
      hideB(),                  // Pindah 2: B -> A
      showA(),                  // A muncul kembali
      Animated.delay(1000),     // waktu baca A
      hideA(),                  // Pindah ke B terakhir
      showB(),                  // B muncul kembali
      Animated.delay(1100),     // waktu baca akhir
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    sequence.start(() => {
      onFinish();
    });

    return () => {
      clearTimeout(pulseTimer);
      sequence.stop();
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>

      {/* Logo Area */}
      <View style={styles.logoWrapper}>
        <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulse1 }], opacity: pulse1Opacity }]} />
        <Animated.View style={[styles.pulseRing, styles.pulseRing2, { transform: [{ scale: pulse2 }], opacity: pulse2Opacity }]} />

        <Animated.Image
          source={require('../../assets/logos/logo-no-background.png')}
          style={[styles.logoImage, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}
          resizeMode="contain"
        />
      </View>

      {/* Brand Title: S hijau, KITA biru */}
      <Animated.View style={[styles.titleBlock, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
        <View style={styles.brandRow}>
          <Text style={styles.brandS}>S</Text>
          <Text style={styles.brandKITA}>KITA</Text>
        </View>
      </Animated.View>

      {/* Subtitle Area dengan ukuran dan gaya font persis sama */}
      <View style={styles.subtitleArea}>
        {/* Teks A: Sekolah Kita, Sekitar Kita */}
        <Animated.View
          style={[
            styles.phraseLayer,
            {
              opacity: textAOpacity,
              transform: [{ translateY: textAY }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.subtitleText}>
            Sekolah Kita, Sekitar Kita
          </Text>
        </Animated.View>

        {/* Teks B: Sistem Kemudahan Informasi & Titik Akses Sekolah */}
        <Animated.View
          style={[
            styles.phraseLayer,
            {
              opacity: textBOpacity,
              transform: [{ translateY: textBY }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.subtitleText}>
            Sistem Kemudahan Informasi &amp; Titik Akses Sekolah
          </Text>
        </Animated.View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>v1.0.0</Text>
      </View>
    </Animated.View>
  );
};

const LOGO_SIZE = width * 0.52;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  pulseRing: {
    position: 'absolute',
    width: LOGO_SIZE * 0.9,
    height: LOGO_SIZE * 0.9,
    borderRadius: LOGO_SIZE * 0.45,
    borderWidth: 2.5,
    borderColor: 'rgba(4, 120, 87, 0.35)',
  },
  pulseRing2: {
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  logoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
  },
  brandS: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#047857', // S Hijau
  },
  brandKITA: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#2563eb', // KITA Biru
  },
  subtitleArea: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    position: 'relative',
    width: '100%',
  },
  phraseLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  subtitleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.2,
    maxWidth: width * 0.8,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
  },
  footerText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '500',
    letterSpacing: 1,
  },
});
