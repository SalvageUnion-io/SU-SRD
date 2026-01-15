'use client'

import { defineRecipe } from '@chakra-ui/react'

export const headingRecipe = defineRecipe({
  base: {
    fontWeight: 'bold',
    alignSelf: 'flex-start',
  },
  variants: {
    level: {
      h1: {
        color: 'su.white',
        bg: 'su.black',
        fontSize: '2em',
        alignSelf: 'flex-start',
        px: 2,
        py: 0.5,
        lineHeight: 1,
        display: 'inline-block',
        width: 'fit-content',
      },
      h2: {
        color: 'su.white',
        bg: 'su.black',
        fontSize: '1.5em',
        alignSelf: 'flex-start',
        px: 2,
        py: 0.5,
        lineHeight: 1,
        display: 'inline-block',
        width: 'fit-content',
      },
      h3: {
        color: 'su.black',
        bg: 'transparent',
        fontSize: '1.17em',
        alignSelf: 'flex-start',
      },
      h4: {
        color: 'su.black',
        bg: 'transparent',
        fontSize: '1em',
        alignSelf: 'flex-start',
      },
      h5: {
        color: 'su.black',
        bg: 'transparent',
        fontSize: '0.83em',
        alignSelf: 'flex-start',
      },
      h6: {
        color: 'su.black',
        bg: 'transparent',
        fontSize: '0.67em',
        alignSelf: 'flex-start',
      },
    },
  },
  defaultVariants: {
    level: 'h3',
  },
})
