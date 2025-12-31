import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'
import { headingRecipe } from './recipes/heading.recipe'
import { textRecipe } from './recipes/text.recipe'
import { buttonRecipe } from './recipes/button.recipe'

export const suColors = {
  blue: 'rgb(143, 195, 216)',
  gameBlue: 'rgb(125, 206, 235)',
  green: 'rgb(122, 151, 138)',
  darkGreen: 'rgb(92, 121, 108)',
  orange: 'rgb(239, 137, 79)',
  darkOrange: 'rgb(200, 100, 50)',
  lightOrange: 'rgb(245, 193, 163)',
  lightBlue: 'rgb(199, 223, 231)',
  lightBlueLighter: 'rgb(205, 226, 233)', // 10% lighter than lightBlue
  lightBlueLighter2: 'rgb(210, 229, 235)', // 10% lighter than lightBlueLighter
  paleBlue: 'rgb(230, 240, 245)', // Paler than lightBlue
  oneBlue: 'rgb(115, 201, 230)',
  oneTwoBlue: 'rgb(101, 185, 215)', // Midpoint between tech level 1 and 2
  twoBlue: 'rgb(87, 169, 200)',
  threeBlue: 'rgb(68, 135, 162)',
  fourBlue: 'rgb(48, 107, 128)',
  fiveBlue: 'rgb(30, 83, 100)',
  sixBlue: 'rgb(6, 52, 65)',
  pink: 'rgb(206, 88, 152)',
  brick: 'rgb(168, 89, 71)',
  paleBrick: 'rgb(210, 160, 140)',
  black: 'rgb(40, 32, 25)',
  white: 'rgb(251, 248, 243)',
  grey: 'rgb(150, 150, 150)',
  lightGrey: 'rgb(100, 100, 100)',
  mediumGrey: 'rgb(130, 130, 130)',
  darkGrey: 'rgb(80, 80, 80)',
  lightGray: 'rgb(199, 199, 199)', // Gray with similar lightness to lightBlue
  deepPurple: 'rgb(60, 30, 80)',
  sicklyYellow: 'rgb(215, 195, 125)', // Sickly yellow for Bio tech level
  silver: 'rgb(192, 192, 192)', // Silvery color for N tech level

  inputBg: 'rgb(232, 229, 216)',
  inputText: 'rgb(45, 62, 54)',
  crawlerPink: 'rgb(206, 88, 152)',
  lightPeach: 'rgb(245, 193, 163)',

  discordBlurple: 'rgb(88, 101, 242)',
  discordBlurpleHover: 'rgb(71, 82, 196)',
}

export const techLevelColors: Record<number, string> = {
  1: suColors.oneBlue,
  2: suColors.twoBlue,
  3: suColors.threeBlue,
  4: suColors.fourBlue,
  5: suColors.fiveBlue,
  6: suColors.sixBlue,
}

const config = defineConfig({
  theme: {
    recipes: {
      heading: headingRecipe,
      text: textRecipe,
      button: buttonRecipe,
    },
    tokens: {
      colors: {
        su: {
          blue: { value: suColors.blue },
          gameBlue: { value: suColors.gameBlue },
          green: { value: suColors.green },
          darkGreen: { value: suColors.darkGreen },
          orange: { value: suColors.orange },
          darkOrange: { value: suColors.darkOrange },
          lightOrange: { value: suColors.lightOrange },
          lightBlue: { value: suColors.lightBlue },
          lightBlueLighter: { value: suColors.lightBlueLighter },
          lightBlueLighter2: { value: suColors.lightBlueLighter2 },
          paleBlue: { value: suColors.paleBlue },
          oneBlue: { value: suColors.oneBlue },
          oneTwoBlue: { value: suColors.oneTwoBlue },
          twoBlue: { value: suColors.twoBlue },
          threeBlue: { value: suColors.threeBlue },
          fourBlue: { value: suColors.fourBlue },
          fiveBlue: { value: suColors.fiveBlue },
          sixBlue: { value: suColors.sixBlue },
          pink: { value: suColors.pink },
          brick: { value: suColors.brick },
          paleBrick: { value: suColors.paleBrick },
          black: { value: suColors.black },
          white: { value: suColors.white },
          grey: { value: suColors.grey },
          lightGrey: { value: suColors.lightGrey },
          mediumGrey: { value: suColors.mediumGrey },
          darkGrey: { value: suColors.darkGrey },
          lightGray: { value: suColors.lightGray },
          deepPurple: { value: suColors.deepPurple },
          sicklyYellow: { value: suColors.sicklyYellow },
          silver: { value: suColors.silver },
          inputBg: { value: suColors.inputBg },
          inputText: { value: suColors.inputText },
          crawlerPink: { value: suColors.crawlerPink },
          lightPeach: { value: suColors.lightPeach },
          discordBlurple: { value: suColors.discordBlurple },
          discordBlurpleHover: { value: suColors.discordBlurpleHover },
        },
      },
      fonts: {
        heading: { value: "'Fira Code', Monaco, Consolas, 'Ubuntu Mono', monospace" },
        body: { value: "'Fira Code', Monaco, Consolas, 'Ubuntu Mono', monospace" },
        mono: { value: "'Fira Code', Monaco, Consolas, 'Ubuntu Mono', monospace" },
      },
      sizes: {
        'builder.border': { value: '8px' },
        'builder.border.sm': { value: '4px' },
        'builder.radius': { value: '24px' },
        'builder.radius.md': { value: '16px' },
        'builder.radius.sm': { value: '8px' },
        'builder.padding': { value: '24px' },
        'builder.padding.md': { value: '16px' },
        'builder.padding.sm': { value: '12px' },
      },
    },
    semanticTokens: {
      colors: {
        // Theme-aware colors for surrounding elements (navigation, backgrounds, etc.)
        // These use CSS variables that respond to the data-theme attribute set by next-themes
        'bg.canvas': { value: 'var(--chakra-colors-bg-canvas)' },
        'bg.surface': { value: 'var(--chakra-colors-bg-surface)' },
        'bg.muted': { value: 'var(--chakra-colors-bg-muted)' },
        'bg.builder': { value: '{colors.su.green}' },
        'bg.builder.mech': { value: '{colors.su.green}' },
        'bg.builder.pilot': { value: '{colors.su.orange}' },
        'bg.builder.crawler': { value: '{colors.su.crawlerPink}' },
        'bg.input': { value: 'var(--chakra-colors-bg-input)' },
        'bg.hover': { value: 'var(--chakra-colors-bg-hover)' },
        'bg.active': { value: 'var(--chakra-colors-bg-active)' },
        'bg.landing': { value: '{colors.su.lightBlue}' },

        'fg.default': { value: 'var(--chakra-colors-fg-default)' },
        'fg.muted': { value: 'var(--chakra-colors-fg-muted)' },
        'fg.inverted': { value: 'var(--chakra-colors-fg-inverted)' },
        'fg.input': { value: '{colors.su.inputText}' },
        'fg.input.label': { value: '{colors.su.inputBg}' },

        'border.default': { value: 'var(--chakra-colors-border-default)' },
        'border.builder': { value: '{colors.su.green}' },
        'border.builder.pilot': { value: '{colors.su.orange}' },
        'border.builder.crawler': { value: '{colors.su.gameBlue}' },

        'brand.solid': { value: '{colors.su.orange}' },
        'brand.muted': { value: '{colors.su.lightOrange}' },
        'brand.srd': { value: 'var(--chakra-colors-brand-srd)' },
      },
    },
  },
  globalCss: {
    ':root, [data-theme="light"]': {
      // Light mode colors
      '--chakra-colors-bg-canvas': suColors.white,
      '--chakra-colors-bg-surface': suColors.lightBlue,
      '--chakra-colors-bg-muted': suColors.lightOrange,
      '--chakra-colors-bg-input': suColors.inputBg,
      '--chakra-colors-bg-hover': suColors.lightOrange,
      '--chakra-colors-bg-active': suColors.lightBlue,
      '--chakra-colors-fg-default': suColors.black,
      '--chakra-colors-fg-muted': suColors.black,
      '--chakra-colors-fg-inverted': suColors.white,
      '--chakra-colors-border-default': suColors.black,
      '--chakra-colors-brand-srd': suColors.brick,
      '--footer-logo-bg': 'transparent',
    },
    '[data-theme="dark"]': {
      // Dark mode colors
      '--chakra-colors-bg-canvas': 'rgb(60, 60, 60)',
      '--chakra-colors-bg-surface': suColors.darkGrey,
      '--chakra-colors-bg-muted': suColors.mediumGrey,
      '--chakra-colors-bg-input': suColors.darkGrey,
      '--chakra-colors-bg-hover': suColors.mediumGrey,
      '--chakra-colors-bg-active': suColors.darkGrey,
      '--chakra-colors-fg-default': suColors.white,
      '--chakra-colors-fg-muted': suColors.grey,
      '--chakra-colors-fg-inverted': suColors.black,
      '--chakra-colors-border-default': suColors.white,
      '--chakra-colors-brand-srd': suColors.orange,
      '--footer-logo-bg': suColors.white,
    },
    body: {
      bg: 'bg.canvas',
      color: 'fg.default',
      fontFamily: 'body',
    },
    code: {
      fontFamily: 'mono',
    },
  },
})

export const system = createSystem(defaultConfig, config)
