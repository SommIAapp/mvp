<Text style={styles.winePrice}>
                  {(() => {
                    const price = wine.price_estimate || wine.price_bottle || wine.price_glass || 0;
                    return price > 0 ? `€${Number.isInteger(price) ? price.toString() : price.toFixed(2)}` : 'Prix sur demande';
                  })()}
                </Text>