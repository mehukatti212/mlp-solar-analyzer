# MLP & Solar - Energia-analyysi

Tämä on interaktiivinen energia-analyysityökalu, jonka avulla taloyhtiöt voivat selvittää tarkalleen, kuinka paljon he säästävät siirtymällä kaukolämmöstä maalämpöön ja mahdollisesti aurinkosähköön. Työkalu laskee investoinnin takaisinmaksuajan ja näyttää siirtymän vaikutuksen suoraan hoitovastikkeeseen jopa 50 vuoden aikajänteellä.

## Ominaisuudet

- **Helppokäyttöinen Chat-käyttöliittymä**: Konsulttimainen käyttöliittymä kerää tarvittavat lähtötiedot vaihe vaiheelta (sisältäen mm. rakennusten ja aurinkopaneelien invertterien määrän).
- **Kattava Kassavirtalaskelma (Tab 1)**: Laskee energiakustannukset, lainan lyhennykset, huoltokulut ja korot. Näyttää 3-vaiheisen hoitovastikepolun (Nyt → Laina-aikana → Lainan jälkeen).
- **50 Vuoden Kokonaiskustannus (Tab 2)**: Vertaa kaukolämpöä ja maalämpöä puolen vuosisadan ajalta.
  - **Kumulatiivinen Kustannuskuvaaja**: Visuaalinen aluekaavio näyttää, miten kaukolämmön kustannukset karkaavat ja maalämpö kerryttää säästöjä.
  - **Laitteistouusinnat**: Ottaa automaattisesti huomioon kaukolämmön lämmönjakokeskuksen vaihdot (20-25v välein), maalämpöpumpun vaihdon (v. 22) sekä invertterien ja paneelien vaihdot.
  - **COP-parannukset**: Historiallinen katsaus ja lämpöpumpun uusiutuessa oletettu teholuvun parannus (esim. 3.2 → 3.7).
- **Reaaliaikainen Parametrien Muokkaus**: Laskeutumissivun raportissa voit muuttaa muuttujia, jolloin sekä taulukot että kuvaajat päivittyvät välittömästi.

## Asennus ja Käyttö

Tämä sovellus on staattinen selainsovellus (HTML, CSS ja Vanilla JavaScript). Se ei vaadi taustajärjestelmää toimiakseen paikallisesti.

1. Kloonaa repositorio
2. Avaa `index.html` suoraan haluamassasi selaimessa
3. Aloita analyysi syöttämällä kohteen tiedot

## Pilveen Julkaisu (Google Cloud Run)

Voit julkaista sovelluksen suoraan Google Cloud Runiin salasanasuojattuna ajamalla asennusscriptin:

```bash
./deploy.sh
```

## Teknologiat

- HTML5
- CSS3 (Vanilla CSS, custom properties, moderni layout)
- JavaScript (ES6+, ei ulkoisia kirjastoja)
