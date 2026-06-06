# MLP & Solar - Energia-analyysi

Tämä on interaktiivinen energia-analyysityökalu, jonka avulla taloyhtiöt voivat selvittää tarkalleen, kuinka paljon he säästävät siirtymällä kaukolämmöstä maalämpöön ja mahdollisesti aurinkosähköön. Työkalu laskee investoinnin takaisinmaksuajan ja näyttää siirtymän vaikutuksen suoraan hoitovastikkeeseen.

## Ominaisuudet

- **Helppokäyttöinen Chat-käyttöliittymä**: Konsulttimainen käyttöliittymä kerää tarvittavat lähtötiedot vaihe vaiheelta.
- **Kattava Kassavirtalaskelma**: Laskee energiakustannukset, lainan lyhennykset ja korot jopa 25 vuoden ajalta.
- **Vastikelaskenta**: Tukee hoitovastikkeen muutoksen tarkastelua sekä neliöperusteisesti (€/m²/kk) että osakeperusteisesti (snt/osake/kk).
- **Reaaliaikainen Parametrien Muokkaus**: Laskeutumissivun raportissa voit muuttaa lainasummaa, korkoa, COP-kerrointa, takaisinmaksuaikaa sekä muita muuttujia, jolloin koko laskelma päivittyy välittömästi ruudulle.
- **PDF-raportin Tulostus**: Työkalu mahdollistaa valmiin analyysin tulostamisen pdf-tiedostoksi jatkotoimenpiteitä ja taloyhtiön hallituksen kokouksia varten.

## Asennus ja Käyttö

Tämä sovellus on staattinen selainsovellus (HTML, CSS ja Vanilla JavaScript). Se ei vaadi taustajärjestelmää, pakettien asennuksia (npm) tai build-työkaluja toimiakseen.

1. Kloonaa repositorio
2. Avaa `index.html` suoraan haluamassasi selaimessa
3. Aloita analyysi syöttämällä kohteen tiedot

## Teknologiat

- HTML5
- CSS3 (Vanilla CSS, custom properties, moderni layout)
- JavaScript (ES6+, ei ulkoisia kirjastoja)
