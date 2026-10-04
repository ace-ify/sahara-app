import { vars } from 'nativewind';

// Raw color values - update these and they sync everywhere
export const colors = {
  light: {
    '--primary': '13 148 136',
    '--primary-foreground': '255 255 255',
    '--card': '255 255 255',
    '--secondary': '241 245 249',
    '--secondary-foreground': '15 23 42',
    '--background': '248 250 252',
    '--popover': '255 255 255',
    '--popover-foreground': '15 23 42',
    '--muted': '241 245 249',
    '--muted-foreground': '100 116 139',
    '--destructive': '220 38 38',
    '--foreground': '15 23 42',
    '--border': '226 232 240',
    '--input': '226 232 240',
    '--ring': '13 148 136',
    '--accent': '204 251 241',
    '--accent-foreground': '15 118 110',
  },
  dark: {
    '--primary-foreground': '23 23 23',
    '--primary': '255 245 245',
    '--card': '23 23 23',
    '--secondary': '38 38 38',
    '--secondary-foreground': '250 250 250',
    '--background': '10 10 10',
    '--popover': '23 23 23',
    '--popover-foreground': '250 250 250',
    '--muted': '38 38 38',
    '--muted-foreground': '161 161 161',
    '--destructive': '255 100 103',
    '--foreground': '250 250 250',
    '--border': '46 46 46',
    '--input': '46 46 46',
    '--accent': '38 38 38',
    '--accent-foreground': '250 250 250',
    '--ring': '115 115 115',
  },
};

// Config for nativewind vars() - used by provider
export const config = {
  light: vars(colors.light),
  dark: vars(colors.dark),
};
