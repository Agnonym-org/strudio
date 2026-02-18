// https://nuxt.com/docs/api/configuration/nuxt-config
import { definePreset } from '@primeuix/themes'
import Nora from '@primeuix/themes/nora'

const StrudioPreset = definePreset(Nora, {
  semantic: {
    primary: {
      50: '#fef2f5',
      100: '#fde6ed',
      200: '#f9b8cc',
      300: '#f58aab',
      400: '#ee4f80',
      500: '#dc265d',
      600: '#c01d4f',
      700: '#a01641',
      800: '#841537',
      900: '#6e1531',
      950: '#3d0a1a',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f0f5fb',
          100: '#dce8f4',
          200: '#bed3ea',
          300: '#92b5d8',
          400: '#6093c2',
          500: '#4275ab',
          600: '#375e97',
          700: '#2d4e7e',
          800: '#284368',
          900: '#1e3a5a',
          950: '#0c1929',
        },
      },
    },
  },
})

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  runtimeConfig: {
    public: {
      strudelDocsUrl: 'https://strudel.cc/workshop/getting-started/',
    },
  },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxtjs/tailwindcss', '@primevue/nuxt-module'],
  primevue: {
    options: {
      theme: {
        preset: StrudioPreset,
        options: {
          darkModeSelector: 'html',
        },
      },
    },
  },
})
