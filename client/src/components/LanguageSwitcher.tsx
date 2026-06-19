import {
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItemRadio,
    Button,
    Tooltip,
    type MenuCheckedValueChangeData,
} from "@fluentui/react-components";
import { GlobeRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

const languages: { code: string; labelKey: "english" | "italian" }[] = [
    { code: "en", labelKey: "english" },
    { code: "it", labelKey: "italian" },
];

export function LanguageSwitcher() {
    const { t, i18n } = useTranslation();

    const currentCode = i18n.language.startsWith("it") ? "it" : "en";

    const handleCheckedValueChange = (
        _: unknown,
        data: MenuCheckedValueChangeData
    ) => {
        const next = data.checkedItems[0];

        if (next) {
            i18n.changeLanguage(next);
        }
    };

    return (
        <Menu
            checkedValues={{ language: [currentCode] }}
            onCheckedValueChange={handleCheckedValueChange}
        >
            <MenuTrigger disableButtonEnhancement>
                <Tooltip content={t("languageSwitcher.label")} relationship="label">
                    <Button
                        appearance="subtle"
                        icon={<GlobeRegular />}
                        aria-label={t("languageSwitcher.label")}
                    >
                        {currentCode.toUpperCase()}
                    </Button>
                </Tooltip>
            </MenuTrigger>

            <MenuPopover>
                <MenuList>
                    {languages.map((lang) => (
                        <MenuItemRadio key={lang.code} name="language" value={lang.code}>
                            {t(`languageSwitcher.${lang.labelKey}`)}
                        </MenuItemRadio>
                    ))}
                </MenuList>
            </MenuPopover>
        </Menu>
    );
}
